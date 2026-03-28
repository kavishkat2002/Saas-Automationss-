import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShoppingBag, CheckCircle2, XCircle, Clock, Search,
  RefreshCw, Loader2, Package, User, Phone, CreditCard,
  ChevronDown, ChevronUp, Receipt
} from "lucide-react";

const API = "http://localhost:5001/api/orders";

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  Pending:  { color: "bg-amber-50 text-amber-700 border-amber-200",  icon: Clock },
  Accepted: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  Rejected: { color: "bg-rose-50 text-rose-700 border-rose-200",    icon: XCircle },
};

function fmt(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString()}`;
}

function OrderReceipt({ order }: { order: any }) {
  const receipt = order.receipt_data || {};
  return (
    <div className="bg-white border border-border rounded-xl p-5 mt-3 text-sm space-y-3">
      <div className="flex items-center gap-2 border-b border-dashed border-border pb-3">
        <Receipt className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground">Order Receipt — #{order.id}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-muted-foreground">
        <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" /><span>Customer</span></div>
        <span className="font-medium text-foreground">{order.customer_name}</span>

        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span>Phone</span></div>
        <span className="font-medium text-foreground">{order.customer_phone}</span>

        <div className="flex items-center gap-2"><Package className="h-3.5 w-3.5" /><span>Product</span></div>
        <span className="font-medium text-foreground">{order.product_name}</span>

        <div><span>Unit Price</span></div>
        <span className="font-mono text-foreground">{fmt(order.product_price)}</span>

        <div><span>Quantity</span></div>
        <span className="font-semibold text-foreground">× {order.quantity}</span>

        <div className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /><span>Payment</span></div>
        <span className="font-medium text-foreground">{order.payment_method}</span>

        <div><span>Ordered At</span></div>
        <span className="text-foreground">{new Date(order.created_at).toLocaleString()}</span>
      </div>

      <div className="border-t border-dashed border-border pt-3 flex justify-between items-center">
        <span className="font-semibold text-foreground">Total Amount</span>
        <span className="text-xl font-bold font-mono text-primary">{fmt(order.total_amount)}</span>
      </div>

      {order.notes && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          📝 {order.notes}
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Pending" | "Accepted" | "Rejected">("All");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const canManage = user?.role === "owner" || user?.role === "admin";

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAccept = async (id: number) => {
    if (!confirm("Accept this order? This will:\n✅ Deduct inventory stock\n✅ Record finance sale\n✅ Mark lead as Sale Completed")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/${id}/accept`, { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Order Accepted ✅", description: "Inventory updated & sale recorded." });
        fetchOrders();
      } else {
        toast({ title: "Cannot Accept", description: data.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return; // cancelled
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        toast({ title: "Order Rejected", description: "Order has been rejected." });
        fetchOrders();
      }
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const filtered = orders.filter(o => {
    const matchFilter = filter === "All" || o.order_status === filter;
    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_phone?.includes(search) ||
      o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    return matchFilter && matchSearch;
  });

  const counts = {
    All: orders.length,
    Pending: orders.filter(o => o.order_status === "Pending").length,
    Accepted: orders.filter(o => o.order_status === "Accepted").length,
    Rejected: orders.filter(o => o.order_status === "Rejected").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" />
            Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">WhatsApp verified customer orders — review, accept, or reject</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2 text-xs h-8">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["All", "Pending", "Accepted", "Rejected"] as const).map(status => {
          const cfg = STATUS_CONFIG[status] || { color: "bg-background text-foreground border-border", icon: ShoppingBag };
          const Icon = cfg.icon;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`border rounded-xl p-4 text-left transition-all hover:shadow-sm ${filter === status ? "ring-2 ring-primary ring-offset-1" : ""} ${status === "All" ? "bg-white border-border" : cfg.color}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{status}</span>
                <Icon className="h-4 w-4 opacity-60" />
              </div>
              <p className="text-2xl font-bold font-mono">{counts[status]}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, product, or order #..."
          className="pl-10 h-10 text-sm"
        />
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">No orders found</p>
          <p className="text-xs text-muted-foreground/60">
            Orders appear here when WhatsApp customers confirm a purchase through the bot
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs text-center">Qty</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Payment</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                {canManage && <TableHead className="text-xs text-right w-36">Actions</TableHead>}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order: any) => {
                const cfg = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.Pending;
                const StatusIcon = cfg.icon;
                const isExpanded = expanded === order.id;
                const isLoading = actionLoading === order.id;

                return (
                  <>
                    <TableRow
                      key={order.id}
                      className={`cursor-pointer hover:bg-muted/20 transition-colors ${isExpanded ? "bg-muted/10" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : order.id)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">#{order.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{order.customer_name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{order.customer_phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium truncate max-w-[140px]">{order.product_name}</p>
                      </TableCell>
                      <TableCell className="text-center text-sm font-mono">{order.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        {fmt(order.total_amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{order.payment_method}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {order.order_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          {order.order_status === "Pending" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                disabled={isLoading}
                                onClick={() => handleAccept(order.id)}
                                className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoading}
                                onClick={() => handleReject(order.id)}
                                className="h-7 text-[11px] px-2.5 border-rose-200 text-rose-600 hover:bg-rose-50 gap-1"
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {order.order_status !== "Pending" && (
                            <span className="text-[10px] text-muted-foreground italic">Processed</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${order.id}-receipt`}>
                        <TableCell colSpan={canManage ? 10 : 9} className="p-4 bg-muted/5">
                          <OrderReceipt order={order} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
