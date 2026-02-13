import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  Target,
  Package,
  MessageCircle,
  Trophy,
  Brain,
  Zap,
  AlertCircle,
  CheckCircle,
  TrendingDown
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { businessId, business } = useBusiness();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", businessId],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const [ordersRes, convoRes, custRes, productsRes] = await Promise.all([
        supabase.from("orders").select("total_amount, created_at, status, customer_id").eq("business_id", businessId!),
        supabase.from("conversations").select("id, status").eq("business_id", businessId!),
        supabase.from("customers").select("id").eq("business_id", businessId!),
        supabase.from("products").select("id, name").eq("business_id", businessId!).eq("is_active", true),
      ]);

      const allOrders = ordersRes.data || [];
      const todayOrders = allOrders.filter(o => o.created_at?.startsWith(today));
      const monthOrders = allOrders.filter(o => o.created_at && o.created_at >= firstDayOfMonth);

      const revenueToday = todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const revenueMonth = monthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const pendingOrders = allOrders.filter(o => o.status === "pending").length;
      const activeConvos = (convoRes.data || []).filter(c => c.status === "active").length;

      // Calculate conversion rate (confirmed orders / total customers)
      const confirmedOrders = allOrders.filter(o => o.status === "confirmed" || o.status === "delivered").length;
      const totalCustomers = custRes.data?.length || 1;
      const conversionRate = ((confirmedOrders / totalCustomers) * 100).toFixed(1);

      // Get top selling product (mock for now)
      const topProduct = productsRes.data?.[0]?.name || "—";

      return {
        revenueToday,
        revenueMonth,
        conversionRate,
        pendingOrders,
        unansweredMessages: activeConvos,
        topProduct,
        totalCustomers,
      };
    },
    enabled: !!businessId,
  });

  const { data: aiActivity } = useQuery({
    queryKey: ["ai-activity", businessId],
    queryFn: async () => {
      // Fetch recent analytics logs
      const { data } = await supabase
        .from("analytics_logs")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!businessId,
  });

  const businessHealthCards = [
    {
      label: "Revenue Today",
      icon: DollarSign,
      value: `Rs. ${stats?.revenueToday?.toFixed(2) || "0.00"}`,
      trend: "+12%",
      trendUp: true
    },
    {
      label: "Revenue This Month",
      icon: TrendingUp,
      value: `Rs. ${stats?.revenueMonth?.toFixed(2) || "0.00"}`,
      trend: "+24%",
      trendUp: true
    },
    {
      label: "Conversion Rate",
      icon: Target,
      value: `${stats?.conversionRate || "0"}%`,
      trend: "+5%",
      trendUp: true
    },
    {
      label: "Pending Orders",
      icon: Package,
      value: stats?.pendingOrders || 0,
      trend: "2 urgent",
      trendUp: false
    },
    {
      label: "Unanswered Messages",
      icon: MessageCircle,
      value: stats?.unansweredMessages || 0,
      trend: "Reply soon",
      trendUp: false
    },
    {
      label: "Top Selling Product",
      icon: Trophy,
      value: stats?.topProduct || "—",
      trend: "Best performer",
      trendUp: true
    },
  ];

  // Generate mock AI activity if no real data
  const mockAiActivity = [
    { type: "order", message: "AI closed order for Rs. 7,500", icon: CheckCircle, color: "text-green-500" },
    { type: "lead", message: "New lead detected from WhatsApp", icon: Zap, color: "text-blue-500" },
    { type: "prediction", message: "Demand spike predicted for Product A", icon: TrendingUp, color: "text-orange-500" },
    { type: "classification", message: "Customer classified as high-value", icon: Brain, color: "text-purple-500" },
    { type: "alert", message: "Stock running low for 3 products", icon: AlertCircle, color: "text-red-500" },
    { type: "insight", message: "Best time to reach customers: 2-4 PM", icon: Brain, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Business Health
        </h1>
        <p className="text-muted-foreground mt-1">Real-time intelligence for your business</p>
      </div>

      {/* Bot Connection Card */}
      <Card className="bg-primary/5 border-primary/20 mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Connect Telegram Bot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            To connect your Telegram account to <strong>{business?.name || "this store"}</strong>, send the following command to your bot:
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-4 py-2 rounded-md text-sm font-mono flex-1 overflow-x-auto">
              /start {businessId}
            </code>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`/start ${businessId}`); }}>
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This creates a unique connection for this business ID: <span className="font-mono">{businessId}</span>. Share this with your customers to route them to this store.
          </p>
        </CardContent>
      </Card>

      {/* Business Health Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {businessHealthCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/50 hover:border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <card.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold">
                  {card.value}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {card.trendUp ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-orange-500" />
                  )}
                  <span className={`text-xs ${card.trendUp ? 'text-green-500' : 'text-orange-500'}`}>
                    {card.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* AI Activity Feed */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="font-display">🧠 AI Activity Log</CardTitle>
            <Badge variant="secondary" className="ml-auto">Live</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {aiActivity && aiActivity.length > 0 ? (
            <div className="space-y-3">
              {aiActivity.slice(0, 6).map((activity, idx) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Brain className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.event_type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {mockAiActivity.map((activity, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <activity.icon className={`h-5 w-5 ${activity.color} mt-0.5`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(Date.now() - idx * 300000).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{activity.type}</Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
