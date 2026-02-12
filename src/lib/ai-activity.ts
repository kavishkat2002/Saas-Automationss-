import { supabase } from "@/integrations/supabase/client";

/**
 * Log AI activity to analytics_logs table
 */
export async function logAiActivity(
    businessId: string,
    eventType: string,
    eventData: Record<string, any> = {}
) {
    try {
        const { error } = await supabase.from("analytics_logs").insert({
            business_id: businessId,
            event_type: eventType,
            event_data: eventData,
        });

        if (error) {
            console.error("Failed to log AI activity:", error);
        }
    } catch (err) {
        console.error("Error logging AI activity:", err);
    }
}

/**
 * Classify customer as high-value based on spending
 */
export async function classifyCustomerValue(
    businessId: string,
    customerId: string,
    totalSpent: number
) {
    const classification = totalSpent >= 10000 ? "high-value" : totalSpent >= 5000 ? "medium-value" : "low-value";

    await logAiActivity(businessId, `Customer classified as ${classification}`, {
        customer_id: customerId,
        total_spent: totalSpent,
        classification,
    });

    return classification;
}

/**
 * Detect demand spike for a product
 */
export async function detectDemandSpike(
    businessId: string,
    productId: string,
    productName: string,
    currentDemand: number,
    averageDemand: number
) {
    if (currentDemand > averageDemand * 1.5) {
        await logAiActivity(businessId, `Demand spike predicted for ${productName}`, {
            product_id: productId,
            current_demand: currentDemand,
            average_demand: averageDemand,
            spike_percentage: ((currentDemand / averageDemand - 1) * 100).toFixed(1),
        });
    }
}

/**
 * Log order completion by AI
 */
export async function logAiOrderCompletion(
    businessId: string,
    orderId: string,
    totalAmount: number
) {
    await logAiActivity(businessId, `AI closed order for Rs. ${totalAmount.toFixed(2)}`, {
        order_id: orderId,
        total_amount: totalAmount,
    });
}

/**
 * Log new lead detection
 */
export async function logNewLead(
    businessId: string,
    customerId: string,
    source: string = "WhatsApp"
) {
    await logAiActivity(businessId, `New lead detected from ${source}`, {
        customer_id: customerId,
        source,
    });
}

/**
 * Log stock alert
 */
export async function logStockAlert(
    businessId: string,
    lowStockProducts: { id: string; name: string; stock: number }[]
) {
    await logAiActivity(businessId, `Stock running low for ${lowStockProducts.length} products`, {
        products: lowStockProducts,
        count: lowStockProducts.length,
    });
}
