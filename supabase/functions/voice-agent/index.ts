
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
        console.log("Voice Webhook Payload:", JSON.stringify(payload));

        const { message } = payload;

        // Vapi sends 'tool-calls' when a tool is triggered
        if (message?.type === "tool-calls") {
            const toolResults = [];

            for (const toolCall of message.toolCalls) {
                const { name, arguments: argsString } = toolCall.function;
                const args = JSON.parse(argsString || "{}");
                let result = {};

                console.log(`Executing tool: ${name}`, args);

                if (name === "get_catalog") {
                    const { data: products } = await supabase
                        .from("products")
                        .select("name, price, stock_unit, description")
                        .eq("is_active", true);
                    result = { products };
                }
                else if (name === "check_order_status") {
                    const phone = formatSLNumber(args.phone_number);
                    const { data: orders } = await supabase
                        .from("orders")
                        .select("id, status, total_amount, created_at, customers!inner(phone)")
                        .eq("customers.phone", phone)
                        .order("created_at", { ascending: false })
                        .limit(1);

                    if (orders && orders.length > 0) {
                        result = { order: orders[0] };
                    } else {
                        result = { error: "No order found for this number." };
                    }
                }
                else if (name === "place_order") {
                    // Logic to create order from voice transcript
                    // This would ideally interact with a customer record
                    result = { success: true, message: "Order initiated. Please confirm via WhatsApp." };
                }

                toolResults.push({
                    toolCallId: toolCall.id,
                    result: JSON.stringify(result)
                });
            }

            return new Response(JSON.stringify({ results: toolResults }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Handle Assistant Request (Initial Prompt / System Config)
        // This is used if using Custom LLM or dynamic system prompt
        if (message?.type === "assistant-request") {
            // In a real scenario, you'd find by phone number called or a custom header
            // For now, we look for the first business or one that has voice enabled
            const { data: businesses } = await supabase
                .from("businesses")
                .select("*")
                .limit(5);

            const business = businesses?.[0]; // Fallback to first

            const systemPrompt = `
You are a friendly and professional AI sales assistant for ${business?.name || "SmartBiz Store"} in Sri Lanka.
Your name is "SmartBiz AI".

LANGUAGE RULES:
1. Speak exclusively in Sinhala unless the customer speaks English.
2. Use a polite, helpful, and natural Sri Lankan Sinhala tone (Ayu-bowan!).
3. If you don't understand something, ask politely in Sinhala.

BUSINESS CONTEXT:
- Business Name: ${business?.name}
- Description: ${business?.description || "A premier retail store in Sri Lanka."}
- Location: Sri Lanka

YOUR TOOLS:
- get_catalog: Use this to see what we have in stock.
- check_order_status: Use this to check where a customer's order is. You will need their phone number.
- place_order: Use this when a customer is ready to buy.

PHONE NUMBER HANDLING:
- Sri Lankan numbers start with +94 or 07. Always format them correctly.

When starting the call, say: "Ayubowan! ${business?.name} ආයතනයට ඔබව සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්නේ?"
`;

            return new Response(JSON.stringify({
                assistant: {
                    name: "SmartBiz Sinhala Agent",
                    model: {
                        provider: "openai",
                        model: "gpt-4o",
                        systemPrompt: systemPrompt,
                    },
                    voice: {
                        provider: "elevenlabs",
                        voiceId: "sri_lanka_voice_id_here", // Placeholder or dynamic
                    },
                    firstMessage: "Ayubowan! SmartBiz වෙත ඔබව සාදරයෙන් පිළිගන්නවා. මම ඔබට කොහොමද උදව් කරන්නේ?",
                }
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("Voice Agent Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
        });
    }
});

function formatSLNumber(phone: string): string {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "94" + clean.substring(1);
    if (!clean.startsWith("94")) clean = "94" + clean;
    return "+" + clean;
}
