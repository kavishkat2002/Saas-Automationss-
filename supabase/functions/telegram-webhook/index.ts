
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
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const payload = await req.json();
        const message = payload.message;
        if (!message) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const chatId = message.chat.id;
        const userId = message.from.id;
        const username = message.from.username || message.from.first_name || "Unknown";
        const text = message.text || "";

        // ==========================================
        // 1. RESOLVE BUSINESS & CONVERSATION CONTEXT
        // ==========================================
        let businessId: string | null = null;
        let conversation: any = null;
        let customer: any = null;

        // Check Deep Link (/start <business_id>) if applicable
        const startMatch = text.match(/^\/start\s+([a-zA-Z0-9-]+)/);
        if (startMatch && startMatch[1]) {
            const { data: validBiz } = await supabase.from("businesses").select("id").eq("id", startMatch[1]).single();
            if (validBiz) businessId = validBiz.id;
        }

        // Resolve context from existing conversation
        if (!businessId) {
            const { data: customerRecords } = await supabase.from("customers").select("id, business_id").eq("phone", `telegram:${userId}`);
            if (customerRecords && customerRecords.length > 0) {
                const { data: latestConvo } = await supabase.from("conversations").select("*").in("customer_id", customerRecords.map((c: any) => c.id)).eq("channel", "telegram").eq("status", "active").order("last_message_at", { ascending: false }).limit(1).single();
                if (latestConvo) {
                    businessId = latestConvo.business_id;
                    conversation = latestConvo;
                } else {
                    businessId = customerRecords[0].business_id;
                }
            }
        }

        // Fallback or Welcome New User
        if (!businessId) {
            const { data: allBiz } = await supabase.from("businesses").select("id").limit(1);
            if (allBiz && allBiz.length > 0) businessId = allBiz[0].id;
        }

        if (!businessId) return new Response(JSON.stringify({ error: "No business found" }), { status: 400 });

        // Get or Create Customer
        const { data: existingCustomer } = await supabase.from("customers").select("*").eq("business_id", businessId).eq("phone", `telegram:${userId}`).single();
        customer = existingCustomer;
        if (!customer) {
            const { data: newCust, error } = await supabase.from("customers").insert({
                business_id: businessId, name: username, phone: `telegram:${userId}`, lead_status: "warm"
            }).select().single();
            if (error) throw error;
            customer = newCust;
        }

        // Get or Create Conversation
        if (!conversation) {
            const { data: newConvo, error } = await supabase.from("conversations").insert({
                business_id: businessId, customer_id: customer.id, channel: "telegram", status: "active", last_message_at: new Date().toISOString(),
                metadata: { state: "browsing", cart: [] }
            }).select().single();
            if (error) throw error;
            conversation = newConvo;
        }

        // Update Last Message Time
        await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

        // ==========================================
        // 2. MAIN STATE MACHINE & ROUTING
        // ==========================================

        if (message.photo) {
            await handlePhotoMessage(message, chatId, businessId, customer, conversation, supabase);
        } else {
            await handleTextMessage(message, text, chatId, businessId, customer, conversation, supabase);
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
});

// ==========================================
// TEXT HANDLER
// ==========================================
async function handleTextMessage(message: any, text: string, chatId: number, businessId: string, customer: any, conversation: any, supabase: any) {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");

    await supabase.from("messages").insert({
        conversation_id: conversation.id, sender_type: "customer", content: text, message_type: "text"
    });

    const state = conversation.metadata?.state || "browsing";
    const intent = detectIntent(text);

    // Global Commands
    if (intent === "cancel") {
        await updateState(conversation.id, "browsing", {}, supabase);
        await sendTelegramMessage(chatId, "🚫 Order cancelled. How can I help you?", TELEGRAM_BOT_TOKEN);
        return;
    }
    if (intent === "track") {
        const orderId = text.replace(/track/i, "").trim().replace("#", "");
        if (orderId) {
            const { data: order } = await supabase.from("orders").select("status, total_amount").eq("id", orderId).single();
            if (order) await sendTelegramMessage(chatId, `📦 Order #${orderId.slice(0, 5)} Status: ${order.status.toUpperCase()}\nAmount: ${order.total_amount}`, TELEGRAM_BOT_TOKEN);
            else await sendTelegramMessage(chatId, "❌ Order not found.", TELEGRAM_BOT_TOKEN);
        } else {
            await sendTelegramMessage(chatId, "Please provide an Order ID. e.g. 'Track #12345'", TELEGRAM_BOT_TOKEN);
        }
        return;
    }

    if (state === "browsing" || state === "cart_building") {
        if (intent === "start" || intent === "greeting") {
            const { data: biz } = await supabase.from("businesses").select("name").eq("id", businessId).single();
            const welcome = `👋 Welcome to *${biz.name}* (v2 AI)!\n\nI can help you with:\n📦 Catalog\n🛒 View Cart\n📋 Order History\n💬 Chat for Assistance\n\nJust tell me what you need!`;
            await sendResponse(chatId, conversation.id, welcome, supabase, TELEGRAM_BOT_TOKEN);
        }
        else if (intent === "catalog") {
            const { data: products } = await supabase.from("products").select("name, price, stock_quantity, stock_unit").eq("business_id", businessId).eq("is_active", true).limit(10);
            let msg = "📦 *Catalog:*\n\n";
            products?.forEach((p, idx) => msg += `${idx + 1}. ${p.name} - ${p.price}\n`);
            msg += "\nTo buy, just say 'I want 2 sugar and 5kg flour'.";
            await sendResponse(chatId, conversation.id, msg, supabase, TELEGRAM_BOT_TOKEN);
        }
        else if (intent === "view_cart") {
            await showCart(chatId, conversation, supabase, TELEGRAM_BOT_TOKEN);
        }
        else if (intent === "checkout") {
            if (!conversation.metadata.cart || conversation.metadata.cart.length === 0) {
                await sendResponse(chatId, conversation.id, "🛒 Your cart is empty!", supabase, TELEGRAM_BOT_TOKEN);
            } else {
                await updateState(conversation.id, "checkout_method", {}, supabase);
                await sendResponse(chatId, conversation.id, "🚚 How would you like to receive your order?\n\nReply 'Delivery' or 'Pickup'.", supabase, TELEGRAM_BOT_TOKEN);
            }
        }
        else {
            const { data: products } = await supabase.from("products").select("*").eq("business_id", businessId).eq("is_active", true);
            const productSummary = products?.map((p) => `${p.name} ($${p.price}/${p.stock_unit || 'unit'})`).join(", ");

            let extraction = await extractOrderDetails(text, productSummary, GEMINI_API_KEY!);

            if (extraction && extraction.items && extraction.items.length > 0) {
                const currentCart = conversation.metadata.cart || [];
                const newCart = [...currentCart];
                let addedItems = [];

                for (const item of extraction.items) {
                    const product = products?.find(p => p.name.toLowerCase().includes(item.product_name.toLowerCase()));
                    if (product) {
                        const existingItemIndex = newCart.findIndex((c: any) => c.product_id === product.id);
                        if (existingItemIndex >= 0) {
                            newCart[existingItemIndex].quantity += item.quantity;
                        } else {
                            newCart.push({
                                product_id: product.id,
                                product_name: product.name,
                                quantity: item.quantity,
                                unit_price: Number(product.price),
                                unit: product.stock_unit || "unit"
                            });
                        }
                        addedItems.push(`${item.quantity} ${product.stock_unit || 'units'} of ${product.name}`);
                    }
                }

                if (addedItems.length > 0) {
                    await updateState(conversation.id, "cart_building", { cart: newCart }, supabase);
                    await sendResponse(chatId, conversation.id, `🛒 Added (v2):\n${addedItems.join("\n")}\n\nReply 'View Cart' or 'Checkout' when ready.`, supabase, TELEGRAM_BOT_TOKEN);
                } else {
                    const aiReply = await chatWithGemini(text, "Sales Assistant", "Retail", "Assisting customer", productSummary, GEMINI_API_KEY!);
                    await sendResponse(chatId, conversation.id, aiReply || "I assume you want to browse. Try asking for our catalog!", supabase, TELEGRAM_BOT_TOKEN);
                }
            } else {
                const aiReply = await chatWithGemini(text, "Sales Assistant", "Retail", "Assisting customer", productSummary, GEMINI_API_KEY!);
                await sendResponse(chatId, conversation.id, aiReply || "I assume you want to browse. Try asking for our catalog!", supabase, TELEGRAM_BOT_TOKEN);
            }
        }
    }

    else if (state === "checkout_method") {
        const lower = text.toLowerCase();
        if (lower.includes("deliver")) {
            await updateState(conversation.id, "checkout_address", { delivery_method: "delivery" }, supabase);
            await sendResponse(chatId, conversation.id, "📍 Please enter your Name, Address, and Contact Number.", supabase, TELEGRAM_BOT_TOKEN);
        } else if (lower.includes("pickup") || lower.includes("pick up")) {
            await updateState(conversation.id, "checkout_address", { delivery_method: "pickup" }, supabase);
            await sendResponse(chatId, conversation.id, "👤 Please enter your Name and Contact Number.", supabase, TELEGRAM_BOT_TOKEN);
        } else {
            await sendResponse(chatId, conversation.id, "Please reply 'Delivery' or 'Pickup'.", supabase, TELEGRAM_BOT_TOKEN);
        }
    }
    else if (state === "checkout_address") {
        await updateState(conversation.id, "checkout_payment", { contact_details: text }, supabase);
        await sendResponse(chatId, conversation.id, "💳 payment option: 'Card', 'Bank Transfer', or 'COD'?", supabase, TELEGRAM_BOT_TOKEN);
    }
    else if (state === "checkout_payment") {
        const lower = text.toLowerCase();
        const cart = conversation.metadata.cart || [];
        const total = cart.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price), 0);

        if (lower.includes("card")) {
            const order = await createOrder(businessId, customer.id, cart, total, "card", "pending", conversation.metadata.contact_details, conversation.metadata.delivery_method, supabase);
            await updateState(conversation.id, "browsing", { cart: [] }, supabase);
            await sendResponse(chatId, conversation.id, `🔗 Payment Link for Order #${order.id.slice(0, 5)}: [Link Placeholder]\nOrder Created!`, supabase, TELEGRAM_BOT_TOKEN);
        }
        else if (lower.includes("bank") || lower.includes("transfer")) {
            const order = await createOrder(businessId, customer.id, cart, total, "bank_transfer", "pending", conversation.metadata.contact_details, conversation.metadata.delivery_method, supabase);
            await updateState(conversation.id, "awaiting_receipt", { current_order_id: order.id }, supabase);

            const { data: b } = await supabase.from("businesses").select("settings").eq("id", businessId).single();
            const bankDetails = b?.settings?.bank_details || "Bank of SmartBiz, Acc: 123456789";

            await sendResponse(chatId, conversation.id, `🏦 Please transfer ${total} to:\n${bankDetails}\n\n📸 Then UPLOAD conversation to complete order within 24hrs.\n(Reply 'Cancel' to abort)`, supabase, TELEGRAM_BOT_TOKEN);
        }
        else if (lower.includes("cod") || lower.includes("cash")) {
            const order = await createOrder(businessId, customer.id, cart, total, "cod", "pending", conversation.metadata.contact_details, conversation.metadata.delivery_method, supabase);
            await updateState(conversation.id, "browsing", { cart: [] }, supabase);
            await sendResponse(chatId, conversation.id, `✅ Order #${order.id.slice(0, 5)} Confirmed!\nTotal: ${total}\nPayment: COD. We will contact you soon.`, supabase, TELEGRAM_BOT_TOKEN);
        } else {
            await sendResponse(chatId, conversation.id, "Please choose 'Card', 'Bank Transfer', or 'COD'.", supabase, TELEGRAM_BOT_TOKEN);
        }
    }
    else if (state === "awaiting_receipt") {
        await sendResponse(chatId, conversation.id, "📸 Please upload the payment receipt photo to confirm your order.", supabase, TELEGRAM_BOT_TOKEN);
    }
}

// ==========================================
// PHOTO HANDLER
// ==========================================
async function handlePhotoMessage(message: any, chatId: number, businessId: string, customer: any, conversation: any, supabase: any) {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const state = conversation.metadata?.state;

    await supabase.from("messages").insert({
        conversation_id: conversation.id, sender_type: "customer", content: "Sent a photo", message_type: "image", metadata: { file_id: message.photo[message.photo.length - 1].file_id }
    });

    const photo = message.photo[message.photo.length - 1];

    if (state === "awaiting_receipt" && conversation.metadata.current_order_id) {
        await sendTelegramMessage(chatId, "🔍 Verifying receipt...", TELEGRAM_BOT_TOKEN);

        const base64 = await getTelegramFile(photo.file_id, TELEGRAM_BOT_TOKEN);
        if (!base64) {
            await sendTelegramMessage(chatId, "❌ Failed to download image. Try again.", TELEGRAM_BOT_TOKEN);
            return;
        }

        const verification = await verifyReceiptWithGemini(base64, GEMINI_API_KEY!);

        if (verification && verification.is_valid_receipt) {
            const orderId = conversation.metadata.current_order_id;
            await supabase.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", orderId);

            await updateState(conversation.id, "browsing", { cart: [], current_order_id: null }, supabase);
            await sendResponse(chatId, conversation.id, `✅ Payment Verified! Order #${orderId.slice(0, 5)} is CONFIRMED.\nDate: ${verification.date}\nAmount: ${verification.amount}`, supabase, TELEGRAM_BOT_TOKEN);
        } else {
            await sendTelegramMessage(chatId, "⚠️ Could not verify receipt. Please upload a clear photo of the bank transfer receipt.", TELEGRAM_BOT_TOKEN);
        }
    } else {
        await sendTelegramMessage(chatId, "🔍 Searching for products...", TELEGRAM_BOT_TOKEN);
        // Placeholder for visual search logic
        await sendTelegramMessage(chatId, "Visual search coming soon.", TELEGRAM_BOT_TOKEN);
    }
}

// ==========================================
// HELPERS
// ==========================================

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

async function showCart(chatId: number, conversation: any, supabase: any, token: string) {
    const cart = conversation.metadata?.cart || [];
    if (cart.length === 0) {
        await sendResponse(chatId, conversation.id, "🛒 Your cart is empty.", supabase, token);
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
    await sendResponse(chatId, conversation.id, msg, supabase, token);
}

async function sendResponse(chatId: number, conversationId: string, text: string, supabase: any, token: string) {
    await supabase.from("messages").insert({
        conversation_id: conversationId, sender_type: "bot", content: text, message_type: "text"
    });
    await sendTelegramMessage(chatId, text, token);
}

async function sendTelegramMessage(chatId: number, text: string, token: string) {
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" })
    });
}

function detectIntent(text: string): string {
    const lower = text.toLowerCase().trim();
    if (["/start", "hi", "hello", "hey"].some(w => lower.startsWith(w))) return "start";
    if (lower.includes("catalog") || lower.includes("products")) return "catalog";
    if (lower.includes("cart") || lower.includes("basket")) return "view_cart";
    if (lower.includes("checkout") || lower.includes("buy now") || lower.includes("order now")) return "checkout";
    if (lower.includes("cancel")) return "cancel";
    if (lower.includes("track")) return "track";
    return "general";
}

// AI Helpers
function safeJSONParse(text: string) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        return JSON.parse(text);
    } catch { return null; }
}

async function extractOrderDetails(text: string, productSummary: string, apiKey: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [{
                text: `System: Extract product orders. Products: [${productSummary}]. User: "${text}".
            Return only a strictly valid JSON object like: { "items": [{ "product_name": "exact_match", "quantity": number }] }. 
            If no products found, items should be empty array.` }]
        }]
    };
    try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) return null;
        return safeJSONParse(raw);
    } catch { return null; }
}

async function chatWithGemini(userText: string, context: string, type: string, desc: string, catalog: string, apiKey: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [{
                text: `System: You are an AI sales assistant for ${context}. Catalog: ${catalog}. 
            User says: "${userText}". 
            Task: Helper user. If they want to buy, kindly ask them to check the catalog or just say product names. Be brief.` }]
        }]
    };
    try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch { return null; }
}

async function verifyReceiptWithGemini(base64: string, apiKey: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [
                { text: "Analyze this image. Is it a bank transfer receipt? Return JSON: { \"is_valid_receipt\": boolean, \"date\": \"YYYY-MM-DD\", \"amount\": \"100.00\", \"reference\": \"...\" }" },
                { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
        }]
    };
    try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await response.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return safeJSONParse(raw || "");
    } catch { return null; }
}

async function getTelegramFile(fileId: string, token: string) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const data = await res.json();
        if (!data.ok) return null;
        const res2 = await fetch(`https://api.telegram.org/file/bot${token}/${data.result.file_path}`);
        const blob = await res2.blob();
        const buf = await blob.arrayBuffer();
        return btoa(String.fromCharCode(...new Uint8Array(buf)));
    } catch { return null; }
}
