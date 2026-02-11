import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { subDays, format, startOfDay } from "date-fns";

export default function Analytics() {
  const { businessId } = useBusiness();

  const { data: orders } = useQuery({
    queryKey: ["analytics-orders", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total_amount, created_at, status")
        .eq("business_id", businessId!)
        .gte("created_at", subDays(new Date(), 30).toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Group by day for charts
  const dailyData = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(subDays(new Date(), 6 - i));
    const dayStr = format(day, "yyyy-MM-dd");
    const dayOrders = (orders || []).filter(o => o.created_at?.startsWith(dayStr));
    return {
      day: format(day, "EEE"),
      revenue: dayOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0),
      orders: dayOrders.length,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Sales Analytics</h1>
        <p className="text-muted-foreground mt-1">Last 7 days performance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display">Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Order Volume</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
