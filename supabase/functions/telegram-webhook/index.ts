import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const payload = await req.json();
        console.log("Telegram webhook payload:", JSON.stringify(payload, null, 2));

        // Extract message data
        const message = payload.message;
        if (!message) {
            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const chatId = message.chat.id;
        const userId = message.from.id;
        const username = message.from.username || message.from.first_name || "Unknown";
        const text = message.text || "";

        // For demo: Use first business in database (in production, map chat to business)
        const { data: businesses } = await supabase
            .from("businesses")
            .select("id")
            .limit(1);

        if (!businesses || businesses.length === 0) {
            throw new Error("No business found");
        }

        const businessId = businesses[0].id;

        // 1. FIND OR CREATE CUSTOMER
        let { data: customer } = await supabase
            .from("customers")
            .select("*")
            .eq("business_id", businessId)
            .eq("phone", `telegram:${userId}`)
            .single();

        if (!customer) {
            const { data: newCustomer, error: customerError } = await supabase
                .from("customers")
                .insert({
                    business_id: businessId,
                    name: username,
                    phone: `telegram:${userId}`,
                    email: null,
                    lead_status: "warm",
                })
                .select()
                .single();

            if (customerError) throw customerError;
            customer = newCustomer;

            // Log new lead
            await supabase.from("analytics_logs").insert({
                business_id: businessId,
                event_type: "New lead detected from Telegram",
                event_data: { customer_id: customer.id, username, telegram_id: userId },
            });
        }

        // 2. FIND OR CREATE CONVERSATION
        let { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("business_id", businessId)
            .eq("customer_id", customer.id)
            .eq("channel", "telegram")
            .eq("status", "active")
            .single();

        if (!conversation) {
            const { data: newConvo, error: convoError } = await supabase
                .from("conversations")
                .insert({
                    business_id: businessId,
                    customer_id: customer.id,
                    channel: "telegram",
                    status: "active",
                    last_message_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (convoError) throw convoError;
            conversation = newConvo;
        } else {
            // Update last message time
            await supabase
                .from("conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conversation.id);
        }

        // 3. SAVE CUSTOMER MESSAGE
        await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "customer",
            content: text,
            message_type: "text",
            metadata: { telegram_message_id: message.message_id },
        });

        // 4. AI: DETECT INTENT AND GENERATE RESPONSE
        let aiResponse = "";
        const intent = detectIntent(text);

        // First, check if any product is mentioned in the message (regardless of intent)
        const { data: allProducts } = await supabase
            .from("products")
            .select("*")
            .eq("business_id", businessId)
            .eq("is_active", true);

        const mentionedProduct = allProducts?.find((p) =>
            text.toLowerCase().includes(p.name.toLowerCase())
        );

        // Check if customer is confirming a previous product suggestion
        // Look for confirmation keywords: yes, add to cart, buy it now, order, confirm
        const isConfirmation = /^(yes|yeah|yep|sure|ok|okay|add to cart|buy it now|order|confirm|buy)$/i.test(text.trim());

        let lastMentionedProduct = null;
        if (isConfirmation && !mentionedProduct) {
            // Customer is confirming but didn't mention a product
            // Check their last message to see if they asked about a product
            const { data: lastMessages } = await supabase
                .from("messages")
                .select("content")
                .eq("conversation_id", conversation.id)
                .eq("sender_type", "customer")
                .order("created_at", { ascending: false })
                .limit(2); // Get last 2 messages (current one is already saved)

            if (lastMessages && lastMessages.length > 1) {
                // Check the previous message for product name
                const previousMessage = lastMessages[1].content.toLowerCase();
                lastMentionedProduct = allProducts?.find((p) =>
                    previousMessage.includes(p.name.toLowerCase())
                );
            }
        }

        if (intent === "start" || intent === "help") {
            aiResponse = `👋 Welcome to SmartBiz AI!

I can help you with:
📦 /catalog - View our products
🛒 /order - Place an order
💬 Just chat with me for assistance!

What would you like to do?`;
        } else if (intent === "catalog") {
            // Fetch products
            const { data: products } = await supabase
                .from("products")
                .select("name, price, stock_quantity, category")
                .eq("business_id", businessId)
                .eq("is_active", true)
                .limit(10);

            if (products && products.length > 0) {
                aiResponse = `📦 *Our Product Catalog:*\n\n`;
                products.forEach((p, idx) => {
                    aiResponse += `${idx + 1}. *${p.name}*\n`;
                    aiResponse += `   💰 Rs. ${Number(p.price).toFixed(2)}\n`;
                    if (p.category) aiResponse += `   📂 ${p.category}\n`;
                    aiResponse += `   📊 Stock: ${p.stock_quantity}\n\n`;
                });
                aiResponse += `\nJust send me the product name to order!`;
            } else {
                aiResponse = "Sorry, we don't have any products available right now.";
            }
        } else if (intent === "order" && mentionedProduct) {
            // Explicit order with product mentioned - AUTO CREATE ORDER
            // CREATE ORDER AUTOMATICALLY
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                    business_id: businessId,
                    customer_id: customer.id,
                    total_amount: Number(mentionedProduct.price),
                    status: "pending",
                    payment_status: "unpaid",
                })
                .select()
                .single();

            if (!orderError && order) {
                // Create order item
                await supabase.from("order_items").insert({
                    order_id: order.id,
                    product_id: mentionedProduct.id,
                    product_name: mentionedProduct.name,
                    quantity: 1,
                    unit_price: Number(mentionedProduct.price),
                    total_price: Number(mentionedProduct.price),
                });

                // Update customer stats
                const newTotalSpent = Number(customer.total_spent || 0) + Number(mentionedProduct.price);
                const newOrderCount = (customer.order_count || 0) + 1;

                await supabase
                    .from("customers")
                    .update({
                        total_spent: newTotalSpent,
                        order_count: newOrderCount,
                    })
                    .eq("id", customer.id);

                // Log AI order creation
                await supabase.from("analytics_logs").insert({
                    business_id: businessId,
                    event_type: `AI closed order for Rs. ${Number(mentionedProduct.price).toFixed(2)}`,
                    event_data: {
                        order_id: order.id,
                        customer_id: customer.id,
                        product_name: mentionedProduct.name,
                        amount: Number(mentionedProduct.price),
                    },
                });

                // Classify customer value
                if (newTotalSpent >= 5000) {
                    await supabase.from("analytics_logs").insert({
                        business_id: businessId,
                        event_type: "Customer classified as high-value",
                        event_data: {
                            customer_id: customer.id,
                            total_spent: newTotalSpent,
                            classification: "high-value",
                        },
                    });
                }

                aiResponse = `✅ *Order Created!*

📦 Product: ${mentionedProduct.name}
💰 Total: Rs. ${Number(mentionedProduct.price).toFixed(2)}
📋 Order ID: ${order.id.slice(0, 8)}

Our team will contact you shortly to confirm payment and delivery details.

Thank you for your order! 🎉`;
            } else {
                aiResponse = `I found ${mentionedProduct.name} but couldn't create the order. Please try again or contact support.`;
            }
        } else if (mentionedProduct && intent !== "order") {
            // Product mentioned but no explicit order keyword - SUGGEST PRODUCT
            aiResponse = `I see you're interested in *${mentionedProduct.name}*! 

💰 Price: Rs. ${Number(mentionedProduct.price).toFixed(2)}
📊 Stock: ${mentionedProduct.stock_quantity} available

To place an order, just reply:
✅ "Yes" or "Add to cart" or "Buy it now"

Or type /catalog to see all products.`;
        } else if (isConfirmation && lastMentionedProduct) {
            // Customer confirmed order for previously mentioned product
            const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                    business_id: businessId,
                    customer_id: customer.id,
                    total_amount: Number(lastMentionedProduct.price),
                    status: "pending",
                    payment_status: "unpaid",
                })
                .select()
                .single();

            if (!orderError && order) {
                await supabase.from("order_items").insert({
                    order_id: order.id,
                    product_id: lastMentionedProduct.id,
                    product_name: lastMentionedProduct.name,
                    quantity: 1,
                    unit_price: Number(lastMentionedProduct.price),
                    total_price: Number(lastMentionedProduct.price),
                });

                const newTotalSpent = Number(customer.total_spent || 0) + Number(lastMentionedProduct.price);
                const newOrderCount = (customer.order_count || 0) + 1;

                await supabase.from("customers").update({
                    total_spent: newTotalSpent,
                    order_count: newOrderCount,
                }).eq("id", customer.id);

                await supabase.from("analytics_logs").insert({
                    business_id: businessId,
                    event_type: `AI closed order for Rs. ${Number(lastMentionedProduct.price).toFixed(2)}`,
                    event_data: {
                        order_id: order.id,
                        customer_id: customer.id,
                        product_name: lastMentionedProduct.name,
                        amount: Number(lastMentionedProduct.price),
                    },
                });

                if (newTotalSpent >= 5000) {
                    await supabase.from("analytics_logs").insert({
                        business_id: businessId,
                        event_type: "Customer classified as high-value",
                        event_data: {
                            customer_id: customer.id,
                            total_spent: newTotalSpent,
                            classification: "high-value",
                        },
                    });
                }

                aiResponse = `✅ *Order Confirmed!*

📦 Product: ${lastMentionedProduct.name}
💰 Total: Rs. ${Number(lastMentionedProduct.price).toFixed(2)}
📋 Order ID: ${order.id.slice(0, 8)}

Our team will contact you shortly to confirm payment and delivery details.

Thank you for your order! 🎉`;
            } else {
                aiResponse = `Sorry, I couldn't create the order. Please try again or contact support.`;
            }
        } else if (intent === "order" && !mentionedProduct) {
            // Order intent but no product matched
            aiResponse = `I'd love to help you order! Please tell me which product you want, or type /catalog to see all products.`;
        } else {
            // General response
            aiResponse = `Thanks for your message! 😊

I'm an AI assistant. Here's what I can do:
• /catalog - View products
• Just send me a product name to order
• Ask me anything!

How can I help you today?`;
        }

        // 5. SAVE BOT RESPONSE TO DATABASE
        await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_type: "bot",
            content: aiResponse,
            message_type: "text",
        });

        // 6. SEND RESPONSE VIA TELEGRAM
        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: aiResponse,
                parse_mode: "Markdown",
            }),
        });

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});

function detectIntent(text: string): string {
    const lower = text.toLowerCase().trim();

    if (lower === "/start" || lower === "/help") return "start";
    if (lower === "/catalog" || lower.includes("catalog") || lower.includes("products") || lower.includes("show me")) {
        return "catalog";
    }
    if (
        lower.includes("order") ||
        lower.includes("buy") ||
        lower.includes("purchase") ||
        lower.includes("/order") ||
        lower.includes("i want")
    ) {
        return "order";
    }

    return "general";
}
