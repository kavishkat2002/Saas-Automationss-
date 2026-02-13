import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const payload = await req.json();
        // console.log("Telegram webhook payload:", JSON.stringify(payload, null, 2));

        const message = payload.message;
        if (!message) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const chatId = message.chat.id;
        const userId = message.from.id;
        const username = message.from.username || message.from.first_name || "Unknown";
        const text = message.text || "";

        // ==========================================
        // MULTI-TENANCY RESOLUTION LOGIC
        // ==========================================
        let businessId: string | null = null;
        let customer = null;
        let conversation = null;

        // 1. Check Deep Link (/start <business_id>)
        // Format: /start <uuid>
        if (text.startsWith("/start ") && text.trim().split(" ").length > 1) {
            const potentialId = text.trim().split(" ")[1];
            // Simple check if it looks like a UUID (length 36 usually, but loose check is fine)
            if (potentialId.length > 20) {
                const { data: validBiz } = await supabase.from("businesses").select("id, name").eq("id", potentialId).single();
                if (validBiz) {
                    businessId = validBiz.id;
                    console.log(`Deep Link: Connecting ${username} to ${validBiz.name} (${businessId})`);
                    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
                    if (TELEGRAM_BOT_TOKEN) {
                        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ chat_id: chatId, text: `🔌 Connected to ${validBiz.name}!` })
                        });
                    }
                }
            }
        }

        // 2. Resolve based on Conversation History (if no deep link found)
        if (!businessId) {
            // Find all customers linked to this Telegram ID
            const { data: customerRecords } = await supabase
                .from("customers")
                .select("id, business_id")
                .eq("phone", `telegram:${userId}`);

            if (customerRecords && customerRecords.length > 0) {
                const customerIds = customerRecords.map((c: any) => c.id);

                // Find the most recently active conversation across ALL businesses for this user
                const { data: latestConvo } = await supabase
                    .from("conversations")
                    .select("business_id, last_message_at")
                    .in("customer_id", customerIds)
                    .eq("channel", "telegram")
                    .eq("status", "active")
                    .order("last_message_at", { ascending: false })
                    .limit(1)
                    .single();

                if (latestConvo) {
                    businessId = latestConvo.business_id;
                    console.log(`Context: Using most recent conversation with business ${businessId}`);
                } else {
                    // No active conversation found, default to first customer record's business
                    businessId = customerRecords[0].business_id;
                    console.log(`Context: Defaulting to business ${businessId} from customer record`);
                }
            }
        }

        // 3. Fallback for Unknown User (New user, no deep link)
        if (!businessId) {
            // Check if there is only one business in the DB (Single Tenant Mode / Demo)
            const { data: allBiz } = await supabase.from("businesses").select("id").limit(2);

            if (allBiz && allBiz.length === 1) {
                // If only 1 business exists, safe to default to it
                businessId = allBiz[0].id;
            } else {
                // Multiple businesses exist, request explicit connection
                const msg = "👋 Welcome! To chat with a specific store, please use their 'Chat with us' link or scan their QR code to start.";
                const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
                if (TELEGRAM_BOT_TOKEN) {
                    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chat_id: chatId, text: msg })
                    });
                }
                return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        // At this point we have a valid businessId
        // Proceed to Create/Get Customer and Conversation for THIS businessId

        // 1. FIND OR CREATE CUSTOMER
        const { data: existingCustomer } = await supabase.from("customers").select("*").eq("business_id", businessId).eq("phone", `telegram:${userId}`).single();
        customer = existingCustomer;

        if (!customer) {
            const { data: newCustomer, error } = await supabase.from("customers").insert({
                business_id: businessId, name: username, phone: `telegram:${userId}`, lead_status: "warm"
            }).select().single();
            if (error) throw error;
            customer = newCustomer;
            await supabase.from("analytics_logs").insert({
                business_id: businessId, event_type: "New lead detected from Telegram", event_data: { customer_id: customer.id, username }
            });
        }

        // 2. FIND OR CREATE CONVERSATION
        const { data: existingConvo } = await supabase.from("conversations").select("*").eq("business_id", businessId).eq("customer_id", customer.id).eq("channel", "telegram").eq("status", "active").single();
        conversation = existingConvo;

        if (!conversation) {
            const { data: newConvo, error } = await supabase.from("conversations").insert({
                business_id: businessId, customer_id: customer.id, channel: "telegram", status: "active", last_message_at: new Date().toISOString()
            }).select().single();
            if (error) throw error;
            conversation = newConvo;
        } else {
            // Update timestamp to mark this as active
            await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
        }

        // 3. DISPATCH HANDLER (PHOTO vs TEXT)
        if (message.photo) {
            await handlePhotoMessage(message, chatId, businessId!, customer, conversation, supabase);
        } else {
            // If /start <id> was used, strip the ID from text so the bot doesn't try to process it as a product query
            let cleanText = text;
            if (cleanText.startsWith("/start ")) cleanText = "/start";

            await handleTextMessage(message, cleanText, chatId, businessId!, customer, conversation, supabase);
        }

        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
});

// ==========================================
// PHOTO HANDLER WITH AI RECOGNITION
// ==========================================
async function handlePhotoMessage(message: any, chatId: number, businessId: string, customer: any, conversation: any, supabase: any) {
    const photo = message.photo[message.photo.length - 1]; // Get largest size
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");

    // Save message log
    await supabase.from("messages").insert({
        conversation_id: conversation.id, sender_type: "customer", content: "Sent a photo", message_type: "image", metadata: { file_id: photo.file_id }
    });

    if (!GEMINI_API_KEY) {
        await sendTelegramMessage(chatId, "⚠️ Image recognition is not configured (Missing User API Key).", TELEGRAM_BOT_TOKEN);
        return;
    }

    await sendTelegramMessage(chatId, "🔍 Analyzing your image...", TELEGRAM_BOT_TOKEN);

    try {
        // 1. Get File Path from Telegram
        const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
        const fileData = await fileRes.json();
        if (!fileData.ok) throw new Error("Failed to get file path");
        const filePath = fileData.result.file_path;

        // 2. Download Image
        const imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
        const imageRes = await fetch(imageUrl);
        const imageBlob = await imageRes.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // 3. Analyze with Gemini
        const analysis = await analyzeImageWithGemini(base64, GEMINI_API_KEY);
        console.log("AI Analysis:", analysis);

        if (!analysis || !analysis.product_name) {
            await sendTelegramMessage(chatId, "🤔 I couldn't clearly identify the product. Could you tell me what it is?", TELEGRAM_BOT_TOKEN);
            return;
        }

        const productName = analysis.product_name;
        const category = analysis.category;

        // 4. Search Availability in DB
        // Determine search term (simple logic: use first 2 words if long, or full name)
        const searchTerm = productName.split(' ').slice(0, 2).join(' ');
        const { data: exactMatches } = await supabase
            .from("products")
            .select("*, currency, stock_unit")
            .ilike("name", `%${searchTerm}%`)
            .eq("business_id", businessId)
            .eq("is_active", true);

        let match = null;
        if (exactMatches && exactMatches.length > 0) {
            match = exactMatches[0];
        }

        // 5. Construct Response
        if (match) {
            if (Number(match.stock_quantity) > 0) {
                const currency = match.currency || "Rs";
                const unit = match.stock_unit || "Qty";
                const msg = `✅ **Yes! We have ${match.name} in stock!**\n\n💰 Price: ${currency}. ${Number(match.price).toFixed(2)}\n📦 Stock: ${match.stock_quantity} ${unit}\n\nDo you want to order it? Reply "Yes" to create an order.`;
                await sendTelegramMessage(chatId, msg, TELEGRAM_BOT_TOKEN);

                // Save context for next "Yes"
                await supabase.from("messages").insert({
                    conversation_id: conversation.id, sender_type: "bot", content: msg, message_type: "text", metadata: { related_product_id: match.id }
                });
            } else {
                await sendTelegramMessage(chatId, `❌ Sorry, **${match.name}** is currently out of stock.`, TELEGRAM_BOT_TOKEN);
                await recommendSimilar(chatId, businessId, category, match.name, supabase, TELEGRAM_BOT_TOKEN);
            }
        } else {
            await sendTelegramMessage(chatId, `❌ Sorry, we don't have exactly **${productName}** in our catalog.`, TELEGRAM_BOT_TOKEN);
            await recommendSimilar(chatId, businessId, category, productName, supabase, TELEGRAM_BOT_TOKEN);
        }

    } catch (e) {
        console.error("Photo processing error", e);
        await sendTelegramMessage(chatId, "Sorry, something went wrong analyzing that image.", TELEGRAM_BOT_TOKEN);
    }
}

async function recommendSimilar(chatId: number, businessId: string, category: string, excludeName: string, supabase: any, token: string) {
    if (!category) return;

    // Search similar by category
    const { data: similar } = await supabase
        .from("products")
        .select("*")
        .eq("category", category)
        .eq("is_active", true)
        .neq("name", excludeName)
        .limit(3);

    if (similar && similar.length > 0) {
        await sendTelegramMessage(chatId, `💡 **But we found these similar items in ${category}:**`, token);

        for (const p of similar) {
            const currency = p.currency || "Rs";
            const unit = p.stock_unit || "Qty";
            const caption = `${p.name}\n💰 ${currency}. ${Number(p.price).toFixed(2)}\n📦 Stock: ${p.stock_quantity} ${unit}`;

            if (p.image_url) {
                // Determine if URL is public (supabase storage) or external
                await sendTelegramPhoto(chatId, p.image_url, caption, token);
            } else {
                await sendTelegramMessage(chatId, caption, token);
            }
        }
    } else {
        await sendTelegramMessage(chatId, `I couldn't find any other items in the ${category} category either.`, token);
    }
}

async function analyzeImageWithGemini(base64Image: string, apiKey: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [
                { text: "Identify the main product in this image. Return strictly valid JSON with keys: 'product_name' (generic name), 'category' (e.g. Vegetables, Fruits, Electronics). Do not use markdown formatting." },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) return null;

    // Clean markdown manually just in case
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    try {
        return JSON.parse(cleanedText);
    } catch {
        return { product_name: cleanedText, category: "General" }; // Fallback
    }
}

// ==========================================
// TEXT HANDLER (Legacy Logic)
// ==========================================
async function handleTextMessage(message: any, text: string, chatId: number, businessId: string, customer: any, conversation: any, supabase: any) {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

    // Save customer message
    await supabase.from("messages").insert({
        conversation_id: conversation.id, sender_type: "customer", content: text, message_type: "text", metadata: { telegram_message_id: message.message_id }
    });

    let aiResponse = "";
    const intent = detectIntent(text);

    // Product search (Mentioned in text)
    const { data: allProducts } = await supabase.from("products").select("*").eq("business_id", businessId).eq("is_active", true);
    const mentionedProduct = allProducts?.find((p) => text.toLowerCase().includes(p.name.toLowerCase()));

    // Confirmation logic
    const isConfirmation = /^(yes|yeah|yep|sure|ok|okay|add to cart|buy it now|order|confirm|buy)$/i.test(text.trim());
    let lastMentionedProduct = null;
    let productToOrder = mentionedProduct;

    // If confirmation but no product in current text, look at history
    if (isConfirmation && !mentionedProduct) {
        // Look at previous BOT messages for "related_product_id" metadata (inserted by Photo Handler or Text Handler)
        const { data: lastBotMessages } = await supabase
            .from("messages")
            .select("metadata")
            .eq("conversation_id", conversation.id)
            .eq("sender_type", "bot")
            .order("created_at", { ascending: false })
            .limit(1);

        if (lastBotMessages && lastBotMessages.length > 0 && lastBotMessages[0].metadata?.related_product_id) {
            const pid = lastBotMessages[0].metadata.related_product_id;
            lastMentionedProduct = allProducts?.find(p => p.id === pid);
        } else {
            // Fallback: check customer text history
            const { data: lastUserMessages } = await supabase
                .from("messages")
                .select("content")
                .eq("conversation_id", conversation.id)
                .eq("sender_type", "customer")
                .order("created_at", { ascending: false })
                .limit(2);

            if (lastUserMessages && lastUserMessages.length > 1) {
                const prevText = lastUserMessages[1].content.toLowerCase();
                lastMentionedProduct = allProducts?.find(p => prevText.includes(p.name.toLowerCase()));
            }
        }
        if (lastMentionedProduct) productToOrder = lastMentionedProduct;
    }

    if (intent === "start" || intent === "help") {
        aiResponse = `👋 Welcome to SmartBiz AI!\n\nI can help you with:\n📦 /catalog - View products\n📷 Send a photo to find items\n💬 Chat to order\n\nHow can I help you?`;
    } else if (intent === "catalog") {
        const { data: products } = await supabase.from("products").select("name, price, stock_quantity, category, currency, stock_unit").eq("business_id", businessId).eq("is_active", true).limit(10);
        if (products && products.length > 0) {
            aiResponse = `📦 *Our Product Catalog:*\n\n`;
            products.forEach((p, idx) => {
                aiResponse += `${idx + 1}. *${p.name}* - ${p.currency || 'Rs'} ${p.price}\n   Stock: ${p.stock_quantity} ${p.stock_unit || 'Qty'}\n`;
            });
            aiResponse += `\nSend a product name or photo to order!`;
        } else {
            aiResponse = "Sorry, no products available.";
        }
    } else if ((intent === "order" && productToOrder) || (isConfirmation && productToOrder)) {
        // Create Order
        const p = productToOrder;
        const { data: order, error } = await supabase.from("orders").insert({
            business_id: businessId, customer_id: customer.id, total_amount: Number(p.price), status: "pending", payment_status: "unpaid"
        }).select().single();

        if (order && !error) {
            await supabase.from("order_items").insert({
                order_id: order.id, product_id: p.id, product_name: p.name, quantity: 1, unit_price: Number(p.price), total_price: Number(p.price)
            });
            // Update stats (simplified for brevity)
            const newSpent = (customer.total_spent || 0) + Number(p.price);
            await supabase.from("customers").update({ total_spent: newSpent, order_count: (customer.order_count || 0) + 1 }).eq("id", customer.id);
            await supabase.from("analytics_logs").insert({ business_id: businessId, event_type: `AI closed order`, event_data: { order_id: order.id, amount: p.price } });

            aiResponse = `✅ *Order Placed!*\n\n📦 ${p.name}\n💰 ${p.currency || 'Rs'} ${p.price}\n📋 ID: #${order.id.slice(0, 5)}\n\nWe'll contact you shortly!`;
        } else {
            aiResponse = "Failed to create order. Please contact support.";
        }
    } else if (productToOrder && intent !== "order") {
        // Suggestion (explicit text mention)
        aiResponse = `Found **${productToOrder.name}**!\n💰 Price: ${productToOrder.currency || 'Rs'} ${productToOrder.price}\nStock: ${productToOrder.stock_quantity}\n\nReply "Yes" or "Buy" to order.`;
        // Save context
        await supabase.from("messages").insert({
            conversation_id: conversation.id, sender_type: "bot", content: aiResponse, message_type: "text", metadata: { related_product_id: productToOrder.id }
        });
        await sendTelegramMessage(chatId, aiResponse, TELEGRAM_BOT_TOKEN);
        return; // Already sent
    } else {
        aiResponse = "I can help you shop! Type a product name or send a photo of what you're looking for.";
    }

    // Save & Send
    await supabase.from("messages").insert({ conversation_id: conversation.id, sender_type: "bot", content: aiResponse, message_type: "text" });
    await sendTelegramMessage(chatId, aiResponse, TELEGRAM_BOT_TOKEN);
}

// ==========================================
// HELPERS
// ==========================================
async function sendTelegramMessage(chatId: number, text: string, token: string) {
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" })
    });
}

async function sendTelegramPhoto(chatId: number, photoUrl: string, caption: string, token: string) {
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption })
    });
}

function detectIntent(text: string): string {
    const lower = text.toLowerCase().trim();
    if (["/start", "/help"].includes(lower)) return "start";
    if (lower.includes("catalog") || lower.includes("products")) return "catalog";
    if (lower.includes("order") || lower.includes("buy") || lower.includes("want") || lower.includes("/order")) return "order";
    return "general";
}
