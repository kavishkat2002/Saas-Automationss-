
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define Types
type ConversationState =
    | "browsing"
    | "cart_building"
    | "checkout_method"
    | "checkout_address"
    | "checkout_payment"
    | "awaiting_payment"
    | "awaiting_receipt"
    | "order_tracking";

interface CartItem {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    unit: string;
}

serve(async (req) => {
    // 1. Verification Request from Meta
    const url = new URL(req.url);
    if (req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token === "smartbiz_verify_token") {
            return new Response(challenge, { status: 200 });
        }

        // Debug Endpoint
        if (!mode) {
            const supabase = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );
            const { count: bizCount } = await supabase.from("businesses").select("*", { count: "exact", head: true });
            const { count: custCount } = await supabase.from("customers").select("*", { count: "exact", head: true });
            const { count: msgCount } = await supabase.from("messages").select("*", { count: "exact", head: true });

            const { data: lastMessages } = await supabase.from("messages").select("sender_type, content, created_at").order("created_at", { ascending: false }).limit(5);

            return new Response(JSON.stringify({
                status: "active",
                counts: { businesses: bizCount, customers: custCount, messages: msgCount },
                last_messages: lastMessages
            }), { headers: { "Content-Type": "application/json" } });
        }

        return new Response("Forbidden", { status: 403 });
    }

    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        console.log("------------------------------------------");
        console.log("Webhook received:", req.method);

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const payload = await req.json();
        console.log("Payload:", JSON.stringify(payload));

        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (!messages || messages.length === 0) {
            console.log("No messages in payload");
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const message = messages[0];
        const from = message.from;
        const businessPhoneNumberId = value.metadata.phone_number_id;
        const messageType = message.type;
        const messageId = message.id; // Unique WhatsApp ID

        console.log(`Processing message from ${from} (ID: ${messageId})`);

        // ==========================================
        // 0. DEDUPLICATION CHECK
        // ==========================================
        const { data: existingMsg } = await supabase.from("messages")
            .select("id")
            .contains("metadata", { whatsapp_id: messageId })
            .limit(1);

        if (existingMsg && existingMsg.length > 0) {
            console.log("Duplicate message ignored:", messageId);
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        let text = "";
        if (messageType === "text") {
            text = message.text.body;
        } else if (messageType === "image") {
            text = message.caption || "";
        }
        console.log(`Message Content: ${text} (${messageType})`);

        // ==========================================
        // 1. RESOLVE BUSINESS & CONVERSATION CONTEXT
        // ==========================================
        let businessId: string | null = null;
        let conversation: any = null;
        let customer: any = null;

        const { data: allBiz } = await supabase.from("businesses").select("id").limit(1);
        if (allBiz && allBiz.length > 0) businessId = allBiz[0].id;

        if (!businessId) {
            // Auto-create business if missing (Self-healing)
            console.log("No business found. Creating default business...");
            const { data: newBiz, error: createBizError } = await supabase.from("businesses").insert({
                name: "My SmartBiz Store",
                settings: { currency: "USD" }
            }).select().single();

            if (createBizError) {
                console.error("Failed to create default business:", createBizError);
                return new Response(JSON.stringify({ error: "No business found and creation failed" }), { status: 200 });
            }
            businessId = newBiz.id;
        }
        console.log("Business Context:", businessId);

        const { data: existingCustomer } = await supabase.from("customers").select("*").eq("business_id", businessId).eq("phone", from).single();
        customer = existingCustomer;
        if (!customer) {
            console.log("Creating new customer...");
            const { data: newCust, error } = await supabase.from("customers").insert({
                business_id: businessId, name: `WhatsApp User ${from.slice(-4)}`, phone: from, lead_status: "warm"
            }).select().single();
            if (error) {
                console.error("Error creating customer:", error);
                throw error;
            }
            customer = newCust;
        }
        console.log("Customer Context:", customer.id);

        const { data: existingConvo } = await supabase.from("conversations").select("*")
            .eq("business_id", businessId)
            .eq("customer_id", customer.id)
            .eq("channel", "whatsapp")
            .eq("status", "active")
            .single();

        conversation = existingConvo;

        if (!conversation) {
            console.log("Creating new conversation...");
            const { data: newConvo, error } = await supabase.from("conversations").insert({
                business_id: businessId, customer_id: customer.id, channel: "whatsapp", status: "active", last_message_at: new Date().toISOString(),
                metadata: { state: "browsing", cart: [] }
            }).select().single();
            if (error) {
                console.error("Error creating conversation:", error);
                throw error;
            }
            conversation = newConvo;
        }

        await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

        if (messageType === "image") {
            // CRITICAL: Process images in background to prevent webhook timeout (Meta requires <15s response)
            const processingPromise = handlePhotoMessage(message, businessPhoneNumberId, from, businessId!, customer, conversation, supabase, messageId);

            if ((globalThis as any).EdgeRuntime && (globalThis as any).EdgeRuntime.waitUntil) {
                console.log("Using EdgeRuntime.waitUntil for image processing");
                (globalThis as any).EdgeRuntime.waitUntil(processingPromise);
            } else {
                console.log("EdgeRuntime not found, awaiting manually (risk of timeout)");
                // If we don't await, the runtime might kill the process, but awaiting risks timeout.
                // We'll try not awaiting and hope Supabase keeps it alive for a bit, or await if we must.
                // For now, let's await to be safe on non-standard envs, but really we rely on waitUntil.
                await processingPromise;
            }

        } else if (text && text.trim().length > 0) {
            console.log("Delegating to handleTextMessage...");
            await handleTextMessage(text, businessPhoneNumberId, from, businessId!, customer, conversation, supabase, messageId);
        } else {
            console.log("Ignored empty text/unsupported message type.");
        }

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    } catch (error: any) {
        console.error("FATAL ERROR in Webhook:", error);
        // CRITICAL: Return 200 OK even on error to prevent WhatsApp from retrying indefinitely
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 200 });
    }
});

async function handleTextMessage(text: string, phoneId: string, to: string, businessId: string, customer: any, conversation: any, supabase: any, messageId: string) {
    try {
        const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
        const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

        // Log Message with ID
        const { error: logError } = await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "customer",
            content: text,
            message_type: "text",
            metadata: { whatsapp_id: messageId }
        });

        if (logError) {
            console.error("Failed to log message:", logError);
            // If we can't log, we might have DB issues, but we should continue? 
            // Actually, if we can't log, dedupe won't work next time. 
            // But let's proceed to reply.
        }

        const state = conversation.metadata?.state || "browsing";
        const intent = detectIntent(text);

        console.log(`Intent Detected: ${intent} (State: ${state})`);

        if (intent === "cancel") {
            await updateState(conversation.id, "browsing", {}, supabase);
            await sendWhatsAppMessage(phoneId, to, "🚫 Order cancelled. How can I help you?", WHATSAPP_TOKEN);
            return;
        }
        // ... (rest of the function, need to ensure we close the try-catch block properly at the end of the function)
        if (intent === "track") {
            const orderId = text.replace(/track/i, "").trim().replace("#", "");
            if (orderId) {
                const { data: order } = await supabase.from("orders").select("status, total_amount").eq("id", orderId).single();
                if (order) await sendWhatsAppMessage(phoneId, to, `📦 Order #${orderId.slice(0, 5)} Status: ${order.status.toUpperCase()}\nAmount: ${order.total_amount}`, WHATSAPP_TOKEN);
                else await sendWhatsAppMessage(phoneId, to, "❌ Order not found.", WHATSAPP_TOKEN);
            } else {
                await sendWhatsAppMessage(phoneId, to, "Please provide an Order ID. e.g. 'Track #12345'", WHATSAPP_TOKEN);
            }
            return;
        }

        if (state === "browsing" || state === "cart_building") {
            if (intent === "start" || intent === "greeting") {
                const { data: biz } = await supabase.from("businesses").select("name").eq("id", businessId).single();
                const welcome = `👋 Welcome to *${biz.name}* (v2.5 Stable)!\n\nI can help you with:\n📦 Catalog\n🛒 View Cart\n📋 Order History\n💬 Chat for Assistance\n\nJust tell me what you need!`;
                await sendResponse(conversation.id, welcome, phoneId, to, supabase, WHATSAPP_TOKEN);
            }
            else if (intent === "catalog") {
                const { data: products } = await supabase.from("products").select("name, price, stock_quantity, stock_unit").eq("business_id", businessId).eq("is_active", true).limit(10);
                if (!products || products.length === 0) {
                    await sendResponse(conversation.id, "🚫 Our catalog is currently empty. Please check back later.", phoneId, to, supabase, WHATSAPP_TOKEN);
                    return;
                }
                let msg = "📦 *Catalog:*\n\n";
                products?.forEach((p, idx) => msg += `${idx + 1}. ${p.name} - ${p.price}\n`);
                msg += "\nTo buy, just say 'I want 2 sugar and 5kg flour'.";
                await sendResponse(conversation.id, msg, phoneId, to, supabase, WHATSAPP_TOKEN);
            }
            else if (intent === "view_cart") {
                await showCart(conversation, phoneId, to, supabase, WHATSAPP_TOKEN);
            }
            else if (intent === "history") {
                const { data: orders } = await supabase.from("orders").select("id, total_amount, status, created_at").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(5);
                if (!orders || orders.length === 0) {
                    await sendResponse(conversation.id, "You have no past orders.", phoneId, to, supabase, WHATSAPP_TOKEN);
                } else {
                    let msg = "📋 *Your Recent Orders:*\n\n";
                    orders.forEach((o: any) => msg += `• #${o.id.slice(0, 5)} - ${o.status.toUpperCase()} (${o.total_amount})\n`);
                    await sendResponse(conversation.id, msg, phoneId, to, supabase, WHATSAPP_TOKEN);
                }
            }
            else if (intent === "assistance") {
                await updateState(conversation.id, "browsing", { needs_assistance: true }, supabase);
                await sendResponse(conversation.id, "👨‍💼 I've flagged this chat for a human agent. Someone will be with you shortly!", phoneId, to, supabase, WHATSAPP_TOKEN);
            }
            else if (intent === "item_remove") {
                const currentCart = conversation.metadata.cart || [];
                if (currentCart.length === 0) {
                    await sendResponse(conversation.id, "🛒 Your cart is already empty.", phoneId, to, supabase, WHATSAPP_TOKEN);
                    return;
                }

                const lowerText = text.toLowerCase();
                const cleanText = lowerText.replace("remove", "").replace("delete", "").replace("take out", "").replace("reduce", "").replace("decrease", "").replace("change", "").replace("less", "").replace("don't", "").replace("dont", "").replace("no", "").replace("not", "").trim();
                const { data: products } = await supabase.from("products").select("id, name, stock_unit").eq("business_id", businessId);

                // Find product user wants to remove
                const targetProduct = products?.find((p: any) => cleanText.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanText));

                if (targetProduct) {
                    const existingItemIndex = currentCart.findIndex((i: any) => i.product_id === targetProduct.id);

                    if (existingItemIndex === -1) {
                        await sendResponse(conversation.id, `❓ ${targetProduct.name} is not in your cart to remove.`, phoneId, to, supabase, WHATSAPP_TOKEN);
                        return;
                    }

                    // Check for quantity to reduce
                    const numberMatch = cleanText.match(/(\d+)/);
                    const reduceQty = numberMatch ? parseInt(numberMatch[0]) : null;

                    const newCart = [...currentCart];
                    let msg = "";

                    if (reduceQty) {
                        newCart[existingItemIndex].quantity -= reduceQty;
                        if (newCart[existingItemIndex].quantity <= 0) {
                            newCart.splice(existingItemIndex, 1);
                            msg = `🗑️ Removed ${targetProduct.name} from cart (Quantity reached 0).`;
                        } else {
                            msg = `📉 Decreased ${targetProduct.name} by ${reduceQty}. (New Total: ${newCart[existingItemIndex].quantity} ${targetProduct.stock_unit || 'units'})`;
                        }
                    } else {
                        // removing entire item if no number specified
                        newCart.splice(existingItemIndex, 1);
                        msg = `🗑️ Removed ${targetProduct.name} from your cart.`;
                    }

                    await updateState(conversation.id, "cart_building", { cart: newCart }, supabase);
                    await sendResponse(conversation.id, msg, phoneId, to, supabase, WHATSAPP_TOKEN);

                } else {
                    await sendResponse(conversation.id, "Please specify which item to remove. e.g. 'Remove sugar'", phoneId, to, supabase, WHATSAPP_TOKEN);
                }
            }
            else if (intent === "checkout") {
                if (!conversation.metadata.cart || conversation.metadata.cart.length === 0) {
                    await sendResponse(conversation.id, "🛒 Your cart is empty!", phoneId, to, supabase, WHATSAPP_TOKEN);
                } else {
                    await updateState(conversation.id, "checkout_method", {}, supabase);
                    await sendResponse(conversation.id, "🚚 How would you like to receive your order?\n\nReply 'Delivery' or 'Pickup'.", phoneId, to, supabase, WHATSAPP_TOKEN);
                }
            }
            else {
                // 1. Get Products
                const { data: products } = await supabase.from("products").select("*").eq("business_id", businessId).eq("is_active", true);
                if (!products || products.length === 0) {
                    await sendResponse(conversation.id, "Our store is currently empty.", phoneId, to, supabase, WHATSAPP_TOKEN);
                    return;
                }

                const productSummary = products?.map((p) => `${p.name} ($${p.price}/${p.stock_unit || 'unit'})`).join(", ");
                let extraction = await extractOrderDetails(text, productSummary, OPENROUTER_API_KEY!);

                // Fallback Heuristic
                if (!extraction || !extraction.items || extraction.items.length === 0) {
                    const lowerText = text.toLowerCase();

                    // SAFETY GUARD: If the text looks like a removal command, DO NOT try to match products for addition.
                    // This prevents "Remove sugar" from turning into "Add sugar" if the intent detector missed it.
                    const negativeKeywords = ["remove", "delete", "minus", "take out", "reduce", "decrease", "change", "less", "don't", "dont", "no", "not"];
                    if (negativeKeywords.some(w => lowerText.includes(w))) {
                        console.log("Skipping fallback addition due to negative keywords:", lowerText);
                        await sendResponse(conversation.id, "I'm not sure what you want to remove/change. Try 'Remove [Item Name]'.", phoneId, to, supabase, WHATSAPP_TOKEN);
                        return;
                    }

                    // Remove common filler words
                    const cleanText = lowerText.replace("i want", "").replace("give me", "").replace("order", "").replace("buy", "").replace("add", "").trim();

                    // Try to find a matching product
                    const potentialProduct = products?.find(p => cleanText.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanText));

                    if (potentialProduct) {
                        // Try to extract a quantity number from the text (e.g. "2 burgers" -> 2)
                        const numberMatch = cleanText.match(/(\d+)/);
                        const qty = numberMatch ? parseInt(numberMatch[0]) : 1;

                        extraction = { items: [{ product_name: potentialProduct.name, quantity: qty }] };
                    }
                }

                let addedItems = [];
                if (extraction && extraction.items && extraction.items.length > 0) {
                    const currentCart = conversation.metadata.cart || [];
                    const newCart = [...currentCart];

                    for (const item of extraction.items) {
                        const product = products?.find(p => p.name.toLowerCase().trim() === item.product_name.toLowerCase().trim() || p.name.toLowerCase().includes(item.product_name.toLowerCase()) || item.product_name.toLowerCase().includes(p.name.toLowerCase()));

                        if (product) {
                            const existingItemIndex = newCart.findIndex((c: any) => c.product_id === product.id);
                            const qty = item.quantity || 1;

                            let currentTotal = qty;

                            if (existingItemIndex >= 0) {
                                newCart[existingItemIndex].quantity += qty;
                                currentTotal = newCart[existingItemIndex].quantity;
                            } else {
                                newCart.push({
                                    product_id: product.id,
                                    product_name: product.name,
                                    quantity: qty,
                                    unit_price: Number(product.price),
                                    unit: product.stock_unit || "unit"
                                });
                            }
                            addedItems.push(`${qty} ${product.stock_unit || 'units'} of ${product.name} (Total: ${currentTotal} ${product.stock_unit || 'units'})`);
                        }
                    }

                    if (addedItems.length > 0) {
                        await updateState(conversation.id, "cart_building", { cart: newCart }, supabase);
                        await sendResponse(conversation.id, `🛒 *Updated Cart:*\n${addedItems.join("\n")}\n\nReply 'View Cart' or 'Checkout'.`, phoneId, to, supabase, WHATSAPP_TOKEN);
                        return;
                    }
                }

                const aiReply = await chatWithGemini(text, "Sales Assistant", "Retail", "Assisting customer.", productSummary, OPENROUTER_API_KEY!);
                await sendResponse(conversation.id, aiReply || "I didn't catch that. Try saying 'I want 2 sugar'.", phoneId, to, supabase, WHATSAPP_TOKEN);
            }
        }
        // ... [State flows remain matched to previous] ...
        else if (state === "checkout_method") {
            const lower = text.toLowerCase();
            if (lower.includes("deliver")) {
                await updateState(conversation.id, "checkout_address", { delivery_method: "delivery" }, supabase);
                await sendResponse(conversation.id, "📍 Please enter your Name, Address, and Contact Number.", phoneId, to, supabase, WHATSAPP_TOKEN);
            } else if (lower.includes("pickup") || lower.includes("pick up")) {
                await updateState(conversation.id, "checkout_address", { delivery_method: "pickup" }, supabase);
                await sendResponse(conversation.id, "👤 Please enter your Name and Contact Number.", phoneId, to, supabase, WHATSAPP_TOKEN);
            } else {
                await sendResponse(conversation.id, "Please reply 'Delivery' or 'Pickup'.", phoneId, to, supabase, WHATSAPP_TOKEN);
            }
        }
        else if (state === "checkout_address") {
            await updateState(conversation.id, "checkout_payment", { contact_details: text }, supabase);
            await sendResponse(conversation.id, "💳 payment option: 'Card', 'Bank Transfer', or 'COD'?", phoneId, to, supabase, WHATSAPP_TOKEN);
        }
        else if (state === "checkout_payment") {
            const lower = text.toLowerCase();
            const cart = conversation.metadata.cart || [];
            const total = cart.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price), 0);

            if (lower.includes("card")) {
                const { data: b } = await supabase.from("businesses").select("payment_gateway_link, payment_gateway_name, name").eq("id", businessId).single();
                let paymentLink = b?.payment_gateway_link;

                const order = await createOrder(businessId, customer.id, cart, total, "card", "pending", conversation.metadata.contact_details, conversation.metadata.delivery_method, supabase);
                await updateState(conversation.id, "browsing", { cart: [] }, supabase);

                if (!paymentLink) {
                    paymentLink = "https://example.com/setup-payment-link";
                    await sendResponse(conversation.id, `⚠️ Payment Link not configured by admin.\nOrder #${order.id.slice(0, 5)} Created!`, phoneId, to, supabase, WHATSAPP_TOKEN);
                } else {
                    await sendResponse(conversation.id, `🔗 Please pay securely here:\n${paymentLink}\n\nOrder #${order.id.slice(0, 5)} Created!`, phoneId, to, supabase, WHATSAPP_TOKEN);
                }
            }
            else if (lower.includes("bank") || lower.includes("transfer")) {
                const order = await createOrder(businessId, customer.id, cart, total, "bank_transfer", "pending", conversation.metadata.contact_details, conversation.metadata.delivery_method, supabase);
                await updateState(conversation.id, "awaiting_receipt", { current_order_id: order.id }, supabase);

                const { data: b } = await supabase.from("businesses").select("bank_name, bank_account_number, bank_account_holder, bank_branch, settings").eq("id", businessId).single();
                let bankDetails = "";
                if (b?.bank_account_number) {
                    bankDetails = `Bank: ${b.bank_name}\nAcc: ${b.bank_account_number}\nHolder: ${b.bank_account_holder}`;
                } else {
                    bankDetails = b?.settings?.bank_details || "Bank Details Not Configured.";
                }
                await sendResponse(conversation.id, `🏦 Please transfer ${total} to:\n${bankDetails}\n\n📸 Then UPLOAD conversation to complete order within 24hrs.\n(Reply 'Cancel' to abort)`, phoneId, to, supabase, WHATSAPP_TOKEN);
            }
            else if (lower.includes("cod") || lower.includes("cash")) {
                const order = await createOrder(businessId, customer.id, cart, total, "cod", "pending", conversation.metadata.contact_details, conversation.metadata.delivery_method, supabase);
                await updateState(conversation.id, "browsing", { cart: [] }, supabase);
                await sendResponse(conversation.id, `✅ Order #${order.id.slice(0, 5)} Confirmed!\nTotal: ${total}\nPayment: COD. We will contact you soon.`, phoneId, to, supabase, WHATSAPP_TOKEN);
            } else {
                await sendResponse(conversation.id, "Please choose 'Card', 'Bank Transfer', or 'COD'.", phoneId, to, supabase, WHATSAPP_TOKEN);
            }
        }
        else if (state === "awaiting_receipt") {
            await sendResponse(conversation.id, "📸 Please upload the payment receipt photo to confirm your order.", phoneId, to, supabase, WHATSAPP_TOKEN);
        }
    } catch (e: any) {
        console.error("Error in handleTextMessage:", e);
        // We do not re-throw because we don't want to trigger a metadata retry loop if logic fails
    }
}

async function handlePhotoMessage(message: any, phoneId: string, to: string, businessId: string, customer: any, conversation: any, supabase: any, messageId: string) {
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const state = conversation.metadata?.state;

    // Log Image
    const mediaId = message.image.id;
    await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_type: "customer",
        content: "Sent a photo",
        message_type: "image",
        metadata: { media_id: mediaId, whatsapp_id: messageId }
    });

    if (state === "awaiting_receipt" && conversation.metadata.current_order_id) {
        await sendWhatsAppMessage(phoneId, to, "🔍 Verifying receipt...", WHATSAPP_TOKEN);
        const imageUrl = await getWhatsAppMediaUrl(mediaId, WHATSAPP_TOKEN);
        if (!imageUrl) {
            await sendWhatsAppMessage(phoneId, to, "❌ Failed to download image. Try again.", WHATSAPP_TOKEN);
            return;
        }
        const imageBlob = await fetch(imageUrl, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } }).then(res => res.blob());
        const base64 = await blobToBase64(imageBlob);
        const verification = await verifyReceiptWithGemini(base64, OPENROUTER_API_KEY!);

        if (verification && verification.is_valid_receipt) {
            const orderId = conversation.metadata.current_order_id;
            await supabase.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", orderId);
            await updateState(conversation.id, "browsing", { cart: [], current_order_id: null }, supabase);
            await sendResponse(conversation.id, `✅ Payment Verified! Order #${orderId.slice(0, 5)} is CONFIRMED.\nDate: ${verification.date}\nAmount: ${verification.amount}`, phoneId, to, supabase, WHATSAPP_TOKEN);
        } else {
            await sendWhatsAppMessage(phoneId, to, "⚠️ Could not verify receipt. Please upload a clear photo of the bank transfer receipt.", WHATSAPP_TOKEN);
        }
    } else {
        await sendWhatsAppMessage(phoneId, to, "🔍 Analysing your photo to find products...", WHATSAPP_TOKEN);

        // 1. Download User Image
        const imageUrl = await getWhatsAppMediaUrl(mediaId, WHATSAPP_TOKEN);
        if (!imageUrl) {
            await sendWhatsAppMessage(phoneId, to, "❌ Failed to download image. Please try again.", WHATSAPP_TOKEN);
            return;
        }
        const imageBlob = await fetch(imageUrl, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } }).then(res => res.blob());
        const base64 = await blobToBase64(imageBlob);

        // 2. Fetch Active Products
        const { data: products } = await supabase.from("products")
            .select("id, name, description, price, stock_unit, image_url")
            .eq("business_id", businessId)
            .eq("is_active", true);

        if (!products || products.length === 0) {
            await sendWhatsAppMessage(phoneId, to, "😕 Our catalog is currently empty.", WHATSAPP_TOKEN);
            return;
        }

        // 3. Identify Product with Gemini
        // We send the product list context + image to Gemini
        const identification = await identifyProductWithGemini(base64, products, OPENROUTER_API_KEY!);

        if (identification && identification.match_found && identification.product_id) {
            const matchedProduct = products.find((p: any) => p.id === identification.product_id);

            if (matchedProduct) {
                // Send Product Card (Image + Caption)
                const caption = `🎯 *Match Found!*\n\n*${matchedProduct.name}*\n${matchedProduct.description || "No description available."}\n\n💰 Price: ${matchedProduct.price}/${matchedProduct.stock_unit || 'unit'}\n\nTo buy, reply: "Add 1 ${matchedProduct.name}"`;

                // If product has an image in DB, we could send that too, or just reply with text if no image.
                // For now, let's reply with the details.
                await sendWhatsAppMessage(phoneId, to, caption, WHATSAPP_TOKEN);
            } else {
                await sendWhatsAppMessage(phoneId, to, `🤔 I thought it was ${identification.product_id} but I can't find it in the list now.`, WHATSAPP_TOKEN);
            }
        } else {
            const reason = identification?.reason || "I couldn't recognize this product in our catalog.";
            await sendWhatsAppMessage(phoneId, to, `❌ ${reason}\n\nTry sending a clearer photo or browsing our catalog.`, WHATSAPP_TOKEN);
        }
    }
}

async function identifyProductWithGemini(base64: string, products: any[], apiKey: string) {
    const url = "https://openrouter.ai/api/v1/chat/completions";

    // Include descriptions as they often have brand names (like "Munchee")
    const productContext = products.map(p => `ID: ${p.id} | Name: ${p.name} | Desc: ${p.description || "N/A"} | Price: ${p.price}`).join("\n");

    const payload = {
        model: "google/gemini-2.0-flash-001", // Using stable Flash 2.0 (often faster/reliable than Exp Pro for free tier)
        messages: [{
            role: "user",
            content: [
                {
                    type: "text",
                    text: `You are a Visual Product Classifier. Follow this process:
                    1. Look at the image and identify the Brand, Product Category, and Pack Weight/Size.
                    2. Compare your findings with this catalog:
                    
                    ${productContext}
                    
                    RULES:
                    - Match based on packaging text (Labels, Logo, Brand names).
                    - "Munchee Cream Cracker" in image should match "Cream Cracker" in catalog.
                    - If you see a weight (e.g. 400g) in the image, try to match it with the catalog name/desc.
                    
                    Return ONLY a JSON object:
                    {
                      "match_found": boolean,
                      "product_id": "ID_FROM_LIST",
                      "reason": "Describe the product you saw and why it matches ID."
                    }`
                },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ]
        }]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s Timeout for heavier vision tasks

    try {
        console.log("Creating Enhanced Vision Request...");
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://smartbiz.ai",
                "X-Title": "SmartBiz AI"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini API Error:", response.status, errText);
            return { match_found: false, reason: `AI Service Busy (Status ${response.status})` };
        }

        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content;
        console.log("Gemini Raw Response:", raw);
        const parsed = safeJSONParse(raw || "");

        // Log to console for debugging
        if (parsed) console.log(`Identification Result: ${parsed.match_found ? 'MATCHED ' + parsed.product_id : 'NO MATCH'}`);

        return parsed;
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error("Gemini Identification Failed:", error);
        if (error.name === "AbortError") {
            return { match_found: false, reason: "Recognition timed out (Large Image). Please try a closer, smaller photo." };
        }
        return null;
    }
}

// Helpers
async function createOrder(businessId: string, customerId: string, cart: any[], total: number, paymentMethod: string, status: string, contactDetails: string, deliveryMethod: string, supabase: any) {
    const { data: order, error } = await supabase.from("orders").insert({
        business_id: businessId, customer_id: customerId, total_amount: total, status: status,
        payment_status: "unpaid", shipping_address: contactDetails, notes: `Method: ${deliveryMethod}, Pay: ${paymentMethod}`
    }).select().single();
    if (error) throw error;
    const items = cart.map(i => ({
        order_id: order.id, product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total_price: i.unit_price * i.quantity
    }));
    await supabase.from("order_items").insert(items);
    return order;
}

async function updateState(conversationId: string, newState: ConversationState, extraMeta: any, supabase: any) {
    const { data: old } = await supabase.from("conversations").select("metadata").eq("id", conversationId).single();
    const oldMeta = old?.metadata || {};
    const newMeta = { ...oldMeta, ...extraMeta, state: newState };
    await supabase.from("conversations").update({ metadata: newMeta }).eq("id", conversationId);
}

async function showCart(conversation: any, phoneId: string, to: string, supabase: any, token: string) {
    const cart = conversation.metadata?.cart || [];
    if (cart.length === 0) {
        await sendResponse(conversation.id, "🛒 Your cart is empty.", phoneId, to, supabase, token);
        return;
    }
    let msg = "🛒 *Your Cart:*\n\n";
    let total = 0;
    cart.forEach((item: any, idx: number) => {
        const lineTotal = item.quantity * item.unit_price;
        total += lineTotal;
        msg += `${idx + 1}. ${item.product_name} x ${item.quantity} = ${lineTotal}\n`;
    });
    msg += `\n💰 *Total: ${total}*\n\nReply 'Checkout' to proceed or add more items.`;
    await sendResponse(conversation.id, msg, phoneId, to, supabase, token);
}

async function sendResponse(conversationId: string, text: string, phoneId: string, to: string, supabase: any, token: string) {
    await supabase.from("messages").insert({
        conversation_id: conversationId, sender_type: "bot", content: text, message_type: "text"
    });
    await sendWhatsAppMessage(phoneId, to, text, token, supabase, conversationId);
}

async function sendWhatsAppMessage(phoneId: string, to: string, text: string, token: string, supabase?: any, conversationId?: string) {
    if (!token) {
        if (supabase && conversationId) {
            await supabase.from("messages").insert({
                conversation_id: conversationId, sender_type: "agent", content: "SYSTEM: Missing WhatsApp Token", message_type: "text"
            });
        }
        return;
    }
    try {
        const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to: to, text: { body: text } })
        });
        const data = await res.json();

        if (!res.ok && supabase && conversationId) {
            console.error("WhatsApp API Error:", data);
            await supabase.from("messages").insert({
                conversation_id: conversationId,
                sender_type: "agent",
                content: `META API ERROR: ${JSON.stringify(data)}`,
                message_type: "text"
            });
        }
    } catch (e: any) {
        if (supabase && conversationId) {
            await supabase.from("messages").insert({
                conversation_id: conversationId,
                sender_type: "agent",
                content: `FETCH ERROR: ${e.message}`,
                message_type: "text"
            });
        }
    }
}

function detectIntent(text: string): string {
    const lower = text.toLowerCase().trim();
    if (["/start", "hi", "hello", "hey"].some(w => lower.startsWith(w))) return "start";

    // High Priority Intents
    if (lower.includes("remove") || lower.includes("delete") || lower.includes("minus") || lower.includes("take out") || lower.includes("don't") || lower.includes("dont")) return "item_remove";
    if (lower.includes("reduce") || lower.includes("decrease") || lower.includes("change") || lower.includes("less") || lower.includes("no ") || lower.startsWith("no ")) return "item_remove";

    if (lower.includes("catalog") || lower.includes("products")) return "catalog";
    if (lower.includes("cart") || lower.includes("basket")) return "view_cart";
    if (lower.includes("history") || lower.includes("previous orders")) return "history";
    if (lower.includes("chat") || lower.includes("support") || lower.includes("human") || lower.includes("assistance") || lower.includes("help")) return "assistance";
    if (lower.includes("checkout") || lower.includes("buy now") || lower.includes("order now")) return "checkout";
    if (lower.includes("cancel")) return "cancel";
    if (lower.includes("track")) return "track";
    return "general";
}

function safeJSONParse(text: string) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(text);
    } catch { return null; }
}

async function extractOrderDetails(text: string, productSummary: string, apiKey: string) {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const payload = {
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [{
            role: "system",
            content: `Extract product orders. 
            Available Products (Exact Names & Units): [${productSummary}]. 
            User Input: "${text}".
            RULES:
            1. If the user mentions a word that matches or is similar to a valid product, include it.
            2. Match "sugar" -> "White Sugar 1kg" (Example). Map loosely.
            3. Default quantity to 1 if not specified or unclear.
            4. UNITS AS QUANTITIES (CRITICAL):
               - If the text mentions a number with a unit (e.g., "2kg", "5L", "3 packets"), USE THAT NUMBER AS THE QUANTITY.
               - Example: "I want 2kg sugar" -> { "product_name": "Sugar", "quantity": 2 }
               - Example: "Give me 5 kg of rice" -> { "product_name": "Rice", "quantity": 5 }
               - Do NOT return quantity 1 if the user explicitly said "2kg". 
            5. Do NOT interpret "to" as "two".
            6. NEGATIVE FILTER: If the user says "remove", "delete", "minus", "take out", "reduce", "change", "less", "don't", "dont", "no", "not", DO NOT extract that product. Return empty items.
            7. Return strict JSON: { "items": [{ "product_name": "MATCHED_NAME", "quantity": number }] }.
            8. Return empty items if absolutely no product related words are found.`
        }]
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://smartbiz.ai", // Required by OpenRouter
                "X-Title": "SmartBiz AI"
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content;
        if (!raw) return null;
        return safeJSONParse(raw);
    } catch { return null; }
}

async function chatWithGemini(userText: string, context: string, type: string, desc: string, catalog: string, apiKey: string) {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const payload = {
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [{
            role: "system",
            content: `You are an AI sales assistant for ${context}. Catalog: ${catalog}. 
            Task: Answer briefly. 
            - If they are asking to buy something that is NOT in the catalog, say "Sorry, we don't have that item. Please check our catalog."
            - If they are being vague (e.g., "I want to buy"), say "Sure! What would you like to order? We have: [list 2-3 items]."
            - Otherwise, be friendly and helpful.`
        }, {
            role: "user",
            content: userText
        }]
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://smartbiz.ai",
                "X-Title": "SmartBiz AI"
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content;
    } catch { return null; }
}

async function verifyReceiptWithGemini(base64: string, apiKey: string) {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const payload = {
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [{
            role: "user",
            content: [
                { type: "text", text: "Analyze this image. Is it a bank transfer receipt? Return JSON: { \"is_valid_receipt\": boolean, \"date\": \"YYYY-MM-DD\", \"amount\": \"100.00\", \"reference\": \"...\" }" },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ]
        }]
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://smartbiz.ai",
                "X-Title": "SmartBiz AI"
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content;
        return safeJSONParse(raw || "");
    } catch { return null; }
}

async function getWhatsAppMediaUrl(mediaId: string, token: string) {
    try {
        const res = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        return data.url;
    } catch { return null; }
}

async function blobToBase64(blob: Blob) {
    const buffer = await blob.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
