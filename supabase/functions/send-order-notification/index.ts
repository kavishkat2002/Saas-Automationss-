
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { order_id, status, custom_message } = await req.json();

        if (!order_id) {
            throw new Error("Missing order_id");
        }

        // Fetch order details with customer info
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select(`
                *,
                customers (
                    id,
                    name,
                    phone,
                    email
                ),
                order_items (
                    product_name,
                    quantity,
                    total_price
                )
            `)
            .eq("id", order_id)
            .single();

        if (orderError || !order) {
            throw new Error(`Order not found: ${orderError?.message}`);
        }

        const customer = order.customers;
        if (!customer) {
            throw new Error("Customer not found for this order");
        }

        // Determine status message
        let statusEmoji = "📦";
        let statusTitle = "Order Update";
        let statusDescription = `Your order status has been updated to: ${status}`;

        switch (status) {
            case "confirmed":
                statusEmoji = "✅";
                statusTitle = "Order Confirmed";
                statusDescription = "Your order has been confirmed and is being processed.";
                break;
            case "packed":
                statusEmoji = "📦";
                statusTitle = "Order Packed";
                statusDescription = "Great news! Your order has been packed and is ready for the next step.";
                break;
            case "ready_for_pickup":
                statusEmoji = "🛍️";
                statusTitle = "Ready for Pickup";
                statusDescription = "Your order is ready for collection! Please visit our store to pick it up.";
                break;
            case "out_for_delivery":
                statusEmoji = "🚚";
                statusTitle = "Out for Delivery";
                statusDescription = "Your order has been handed over to our delivery partner and is on its way!";
                break;
            case "shipped":
                statusEmoji = "🚚";
                statusTitle = "Order Shipped";
                statusDescription = "Your order has been shipped.";
                break;
            case "delivered":
                statusEmoji = "🎉";
                statusTitle = "Order Delivered";
                statusDescription = "Your order has been delivered. Enjoy your purchase!";
                break;
            case "cancelled":
                statusEmoji = "❌";
                statusTitle = "Order Cancelled";
                statusDescription = "Your order has been cancelled.";
                break;
        }

        // Construct notification message
        let messageText = `${statusEmoji} *${statusTitle}*\n\n`;
        messageText += `Hello ${customer.name}, \n\n${statusDescription}\n`;

        if (custom_message && custom_message.trim() !== "") {
            messageText += `\n📝 *Note from Store:*\n${custom_message}\n`;
        }

        messageText += `\n📋 *Order Details:*\n`;
        messageText += `Order ID: #${order.id.slice(0, 8)}\n`;
        messageText += `Total Amount: Rs. ${Number(order.total_amount).toFixed(2)}\n`;

        // Add items summary if needed, keeping it brief
        if (order.order_items && order.order_items.length > 0) {
            const itemsSummary = order.order_items.map((i: any) => `${i.quantity}x ${i.product_name}`).join(", ");
            messageText += `Items: ${itemsSummary}\n`;
        }

        messageText += `\nThank you for shopping with us!`;

        console.log(`Sending notification to customer ${customer.id} (${customer.phone})`);

        let sent = false;

        // Check if Telegram customer
        if (customer.phone && customer.phone.startsWith("telegram:")) {
            const telegramId = customer.phone.split(":")[1];
            const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

            if (botToken) {
                const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: telegramId,
                        text: messageText,
                        parse_mode: "Markdown",
                    }),
                });

                const result = await response.json();
                if (result.ok) {
                    sent = true;
                    console.log("Telegram message sent successfully");
                } else {
                    console.error("Telegram API error:", result);
                }
            } else {
                console.error("TELEGRAM_BOT_TOKEN not set");
            }
        }

        // Also save to database messages table if a conversation exists
        // Find existing conversation
        const { data: conversation } = await supabase
            .from("conversations")
            .select("id")
            .eq("customer_id", customer.id)
            .limit(1)
            .single();

        if (conversation) {
            await supabase.from("messages").insert({
                conversation_id: conversation.id,
                sender_type: "bot",
                content: messageText,
                message_type: "text",
            });
            // Update conversation to mark as active context for multi-tenancy routing
            await supabase.from("conversations").update({
                last_message_at: new Date().toISOString()
            }).eq("id", conversation.id);
        }

        return new Response(JSON.stringify({ success: true, sent }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
