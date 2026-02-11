import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, MessageSquare, Users } from "lucide-react";
import { motion } from "framer-motion";

const statCards = [
  { label: "Revenue Today", icon: DollarSign, key: "revenue", prefix: "$" },
  { label: "Orders Today", icon: ShoppingCart, key: "orders", prefix: "" },
  { label: "Active Conversations", icon: MessageSquare, key: "conversations", prefix: "" },
  { label: "Total Customers", icon: Users, key: "customers", prefix: "" },
];

export default function Dashboard() {
  const { businessId } = useBusiness();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", businessId],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const [ordersRes, convoRes, custRes] = await Promise.all([
        supabase.from("orders").select("total_amount, created_at").eq("business_id", businessId!),
        supabase.from("conversations").select("id").eq("business_id", businessId!).eq("status", "active"),
        supabase.from("customers").select("id").eq("business_id", businessId!),
      ]);

      const todayOrders = (ordersRes.data || []).filter(o => o.created_at?.startsWith(today));
      const revenue = todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      return {
        revenue: revenue.toFixed(2),
        orders: todayOrders.length,
        conversations: convoRes.data?.length || 0,
        customers: custRes.data?.length || 0,
      };
    },
    enabled: !!businessId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Overview</h1>
        <p className="text-muted-foreground mt-1">Your business at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold">
                  {card.prefix}{stats?.[card.key as keyof typeof stats] ?? "—"}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No recent activity yet. Start by adding products and customers.</p>
        </CardContent>
      </Card>
    </div>
  );
}
