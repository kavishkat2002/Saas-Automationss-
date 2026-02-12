
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Setup Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// HELPER: OpenAI Chat Completion
async function generateAIResponse(message: string, products: any[]) {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return null;

    const productContext = products.map(p =>
        `- ${p.name}: Rs. ${p.price} (${p.stock_quantity} in stock)`
    ).join("\n");

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful sales assistant for SmartBiz Demo Store.
                        
                        YOUR GOAL: Help customers find products and answer their questions naturally.
                        
                        CATALOG:
                        ${productContext}
                        
                        RULES:
                        1. Only recommend products from the catalog.
                        2. If they ask about something not in catalog, say we don't have it.
                        3. Keep answers short, friendly, and helpful.
                        4. If they want to buy/order, encourage them to say "I want to order [Product Name]" or "Buy [Product Name]".
                        
                        IMPORTANT: Do NOT process orders yourself. Just guide them to say the order command.`
                    },
                    { role: "user", content: message }
                ],
            }),
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error("OpenAI Error:", e);
        return null; // Fallback to rule-based
    }
}

// HELPER: Handle Order Creation
async function createOrderTransaction(businessId: any, customer: any, product: any) {
    // 1. Create Order Record
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            business_id: businessId,
            customer_id: customer.id,
            total_amount: Number(product.price),
            status: "pending",
            payment_status: "unpaid",
        })
        .select()
        .single();

    if (orderError || !order) {
        console.error("Order Creation Error:", orderError);
        return null;
    }

    // 2. Create Order Item
    await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: Number(product.price),
        total_price: Number(product.price),
    });

    // 3. Update Customer Stats
    const newTotalSpent = Number(customer.total_spent || 0) + Number(product.price);
    const newOrderCount = (customer.order_count || 0) + 1;

    await supabase.from("customers").update({
        total_spent: newTotalSpent,
        order_count: newOrderCount,
    }).eq("id", customer.id);

    // 4. Log Analytics
    await supabase.from("analytics_logs").insert({
        business_id: businessId,
        event_type: `AI closed order for Rs. ${Number(product.price).toFixed(2)}`,
        event_data: {
            order_id: order.id,
            customer_id: customer.id,
            product_name: product.name,
            amount: Number(product.price),
        },
    });

    return order;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);

        // --- 1. VERIFICATION ---
        if (req.method === "GET") {
            const mode = url.searchParams.get("hub.mode");
            const token = url.searchParams.get("hub.verify_token");
            const challenge = url.searchParams.get("hub.challenge");
            if (mode === "subscribe" && token === "smartbiz_verify_token") {
                return new Response(challenge, { status: 200 });
            }
            return new Response("Forbidden", { status: 403 });
        }

        // --- 2. PRE-CHECKS ---
        const payload = await req.json();
        const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages;
        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
        }

        const message = messages[0];
        const from = message.from;
        const messageText = message.text?.body || "";
        const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

        // --- 3. BUSINESS CHECK ---
        const { data: businesses } = await supabase.from("businesses").select("id").limit(1);
        if (!businesses || businesses.length === 0) {
            // Error feedback
            const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
            if (WHATSAPP_API_TOKEN && phoneNumberId) {
                await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ messaging_product: "whatsapp", to: from, text: { body: "⚠️ System Error: No Business Found." } }),
                });
            }
            return new Response(JSON.stringify({ error: "No business" }), { headers: corsHeaders, status: 200 });
        }
        const businessId = businesses[0].id;

        // --- 4. CUSTOMER CHECK ---
        let { data: customer } = await supabase
            .from("customers")
            .select("*")
            .eq("business_id", businessId)
            .eq("phone", from)
            .single();

        if (!customer) {
            const { data: newCustomer } = await supabase
                .from("customers")
                .insert({ business_id: businessId, name: `WhatsApp ${from.slice(-4)}`, phone: from, lead_status: "warm" })
                .select()
                .single();
            customer = newCustomer;
        }

        // --- 5. CONVERSATION CHECK ---
        let { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("business_id", businessId)
            .eq("customer_id", customer.id)
            .eq("channel", "whatsapp")
            .single();

        if (!conversation) {
            const { data: newConvo } = await supabase
                .from("conversations")
                .insert({ business_id: businessId, customer_id: customer.id, channel: "whatsapp" })
                .select()
                .single();
            conversation = newConvo;
        }

        // --- 6. SAVE USER MSG ---
        await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "customer",
            content: messageText,
            message_type: "text"
        });

        // --- 7. INTELLIGENCE LAYER ---
        const { data: allProducts } = await supabase
            .from("products")
            .select("*")
            .eq("business_id", businessId)
            .eq("is_active", true);

        // A. Detection Phase
        const lowerText = messageText.toLowerCase();
        const mentionedProduct = allProducts?.find((p) => lowerText.includes(p.name.toLowerCase()));

        // Check for Buying Intent (Rule Based for reliability)
        const isOrderIntent = /^(buy|order|purchase|i want|get me|add to cart)/i.test(lowerText);
        const isConfirmation = /^(yes|yeah|sure|confirm|ok)/i.test(lowerText);

        let aiResponse = "";

        // B. Action Phase
        if (isOrderIntent && mentionedProduct) {
            // ACTION: Create Order
            const order = await createOrderTransaction(businessId, customer, mentionedProduct);
            if (order) {
                aiResponse = `✅ *Order Created!*\n\n📦 ${mentionedProduct.name}\n💰 Rs. ${mentionedProduct.price}\n📋 ID: ${order.id.slice(0, 8)}\n\nWe'll contact you for payment!`;
            } else {
                aiResponse = "Sorry, I couldn't place the order right now.";
            }
        }
        else if (isConfirmation && !mentionedProduct) {
            // ACTION: Confirm Contextual Order
            const { data: lastMessages } = await supabase
                .from("messages")
                .select("content")
                .eq("conversation_id", conversation.id)
                .order("created_at", { ascending: false })
                .limit(3);

            let lastProduct = null;
            if (lastMessages) {
                for (const msg of lastMessages) {
                    const found = allProducts?.find((p) => msg.content.toLowerCase().includes(p.name.toLowerCase()));
                    if (found) { lastProduct = found; break; }
                }
            }

            if (lastProduct) {
                const order = await createOrderTransaction(businessId, customer, lastProduct);
                if (order) {
                    aiResponse = `✅ *Order Confirmed!*\n\n📦 ${lastProduct.name}\n💰 Rs. ${lastProduct.price}\n📋 ID: ${order.id.slice(0, 8)}\n\nThanks for ordering!`;
                }
            } else {
                // If no context, fall back to AI
                aiResponse = await generateAIResponse(messageText, allProducts || []) || "I'm not sure what you'd like to confirm.";
            }
        }
        else {
            // ACTION: General Chat (Use OpenAI)
            console.log("Using OpenAI for response...");
            aiResponse = await generateAIResponse(messageText, allProducts || []) || "Sorry, I'm having trouble thinking right now.";
        }

        // --- 8. SEND RESPONSE ---
        if (aiResponse) {
            await supabase.from("messages").insert({
                conversation_id: conversation.id,
                sender_type: "bot",
                content: aiResponse,
                message_type: "text"
            });

            const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
            if (WHATSAPP_API_TOKEN && phoneNumberId) {
                await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ messaging_product: "whatsapp", to: from, text: { body: aiResponse } }),
                });
            }
        }

        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders, status: 200 });

    } catch (error: any) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 200 });
    }
});
