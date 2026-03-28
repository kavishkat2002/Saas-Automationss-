import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line
} from "recharts";
import { Loader2, ShoppingBag, TrendingUp, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const sourceColors: Record<string, string> = {
  whatsapp: "#10B981", facebook: "#2563EB", instagram: "#EC4899",
  tiktok: "#0F172A", web: "#1570EF", manual: "#6B7280"
};
const sourceLabels: Record<string, string> = {
  whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram",
  tiktok: "TikTok", web: "Website", manual: "Manual"
};
const ORDER_STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b", Accepted: "#10b981", Rejected: "#ef4444"
};

const tooltipStyle = {
  backgroundColor: "#fff", borderRadius: "8px",
  border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", fontSize: "12px"
};

const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;

// Chart card wrapper
function ChartCard({ title, sub, children, className = "" }: any) {
  return (
    <div className={`border border-border rounded-xl bg-white overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Analytics() {
  const [leads, setLeads] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:5001/api/leads").then(r => r.json()),
      fetch("http://localhost:5001/api/orders").then(r => r.json()),
    ]).then(([ld, od]) => {
      setLeads(Array.isArray(ld) ? ld : []);
      setOrders(Array.isArray(od) ? od : []);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, []);

  // ── Lead processing ──────────────────────────────────────────────────────
  const sourceCounts = leads.reduce((acc, lead) => {
    const src = lead.source || 'manual';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sourceData = Object.entries(sourceCounts)
    .map(([src, count]) => ({ name: sourceLabels[src] || src, value: count, fill: sourceColors[src] || "#D1D5DB" }))
    .sort((a, b) => Number(b.value) - Number(a.value));

  const leadsTimeline = (() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayLeads = leads.filter(l => l.created_at?.startsWith(dateStr));
      data.push({ name: dayName, leads: dayLeads.length, closed: dayLeads.filter(l => l.status === 'Sale Completed' || l.status?.toLowerCase() === 'closed deal').length });
    }
    return data;
  })();

  // ── Orders processing ────────────────────────────────────────────────────
  // Daily orders — last 14 days
  const ordersTimeline = (() => {
    const data = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayOrders = orders.filter(o => o.created_at?.split('T')[0] === dateStr);
      data.push({
        name: dayName,
        total: dayOrders.length,
        accepted: dayOrders.filter(o => o.order_status === 'Accepted').length,
        rejected: dayOrders.filter(o => o.order_status === 'Rejected').length,
        pending: dayOrders.filter(o => o.order_status === 'Pending').length,
        revenue: dayOrders.filter(o => o.order_status === 'Accepted').reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
      });
    }
    return data;
  })();

  // Status breakdown pie
  const orderStatusData = [
    { name: "Accepted", value: orders.filter(o => o.order_status === "Accepted").length, color: ORDER_STATUS_COLORS.Accepted },
    { name: "Pending",  value: orders.filter(o => o.order_status === "Pending").length,  color: ORDER_STATUS_COLORS.Pending },
    { name: "Rejected", value: orders.filter(o => o.order_status === "Rejected").length, color: ORDER_STATUS_COLORS.Rejected },
  ].filter(d => d.value > 0);

  // Revenue by product (from accepted orders)
  const productRevMap: Record<string, number> = {};
  orders.filter(o => o.order_status === "Accepted").forEach((o: any) => {
    const key = o.product_name || "Unknown";
    productRevMap[key] = (productRevMap[key] || 0) + Number(o.total_amount || 0);
  });
  const revenueByProduct = Object.entries(productRevMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // KPI summary
  const totalOrders = orders.length;
  const acceptedOrders = orders.filter(o => o.order_status === "Accepted").length;
  const totalOrderRevenue = orders.filter(o => o.order_status === "Accepted").reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const avgOrderValue = acceptedOrders > 0 ? totalOrderRevenue / acceptedOrders : 0;
  const conversionRate = totalOrders > 0 ? ((acceptedOrders / totalOrders) * 100).toFixed(1) : "0.0";

  if (loading) return (
    <div className="flex justify-center items-center h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">Analytics & Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Deep dive into sales performance, lead sources, and order insights.</p>
      </div>

      {/* ── ORDERS KPI BAR ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <ShoppingBag className="h-3.5 w-3.5" /> Order Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Orders", value: totalOrders, icon: ShoppingBag, color: "bg-indigo-500", sub: "All-time" },
            { label: "Accepted", value: acceptedOrders, icon: CheckCircle2, color: "bg-emerald-500", sub: `${conversionRate}% conversion` },
            { label: "Total Revenue", value: fmt(totalOrderRevenue), icon: TrendingUp, color: "bg-amber-500", sub: "From accepted orders" },
            { label: "Avg Order Value", value: fmt(avgOrderValue), icon: ShoppingBag, color: "bg-violet-500", sub: "Per accepted order" },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                <div className={`h-8 w-8 rounded-lg ${color} flex items-center justify-center`}>
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-foreground leading-none">{value}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── ORDERS CHARTS ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <ShoppingBag className="h-3.5 w-3.5" /> Order Analytics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

          {/* Orders over time - area */}
          <ChartCard
            title="Orders (Last 14 Days)"
            sub="Total, accepted, and rejected orders per day"
            className="col-span-full lg:col-span-2"
          >
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ordersTimeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="oTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="oAccepted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#oTotal)" name="Total Orders" />
                  <Area type="monotone" dataKey="accepted" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#oAccepted)" name="Accepted" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Status donut */}
          <ChartCard title="Order Status" sub="Breakdown by status">
            <div className="h-[240px]">
              {orderStatusData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No orders yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80} innerRadius={50} paddingAngle={3}>
                      {orderStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value, entry: any) => (
                        <span style={{ color: entry.color }}>{value}: {entry.payload.value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Status badges */}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {[
                { label: "Accepted", count: orders.filter(o => o.order_status === "Accepted").length, color: "border-emerald-200 text-emerald-700 bg-emerald-50" },
                { label: "Pending",  count: orders.filter(o => o.order_status === "Pending").length,  color: "border-amber-200 text-amber-700 bg-amber-50" },
                { label: "Rejected", count: orders.filter(o => o.order_status === "Rejected").length, color: "border-rose-200 text-rose-700 bg-rose-50" },
              ].map(s => (
                <Badge key={s.label} variant="outline" className={`text-[10px] ${s.color}`}>
                  {s.label}: {s.count}
                </Badge>
              ))}
            </div>
          </ChartCard>

          {/* Daily order revenue bar */}
          <ChartCard
            title="Daily Order Revenue (Last 14 Days)"
            sub="Revenue from accepted WhatsApp orders"
            className="col-span-full lg:col-span-2"
          >
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Revenue by product */}
          <ChartCard title="Revenue by Product" sub="From accepted orders">
            <div className="h-[220px]">
              {revenueByProduct.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No accepted orders yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByProduct} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" hide tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fill: '#374151', fontSize: 10, fontWeight: 500 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="revenue" radius={[0, 5, 5, 0]} name="Revenue">
                      {revenueByProduct.map((_, i) => (
                        <Cell key={i} fill={["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"][i % 8]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

        </div>
      </div>

      {/* ── LEADS CHARTS ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" /> Lead Analytics
        </h2>
        {leads.length === 0 ? (
          <div className="border border-border rounded-xl bg-white p-16 text-center">
            <p className="text-sm text-muted-foreground">No leads data yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ChartCard title="Lead Generation (Past 7 Days)" sub="Incoming leads vs deals closed" className="col-span-full lg:col-span-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={leadsTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1570EF" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#1570EF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="leads" stroke="#1570EF" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" name="Total Leads" />
                    <Area type="monotone" dataKey="closed" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorClosed)" name="Closed Deals" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Lead Sources" sub="Where your leads come from">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }} />
                    <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}
