import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, Landmark, Receipt,
  Plus, Trash2, Loader2, ArrowUpRight, ArrowDownRight, PieChart,
  RefreshCw, BarChart3, AlertTriangle, ShoppingBag, CalendarRange, X
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend
} from "recharts";

const API = "http://localhost:5001/api/finance";

const EXPENSE_CATEGORIES = [
  "Rent / Lease", "Salaries & Wages", "Utilities", "Inventory / Stock",
  "Marketing & Advertising", "Transport & Delivery", "Equipment & Tools",
  "Repairs & Maintenance", "Professional Services", "Insurance",
  "Taxes & Licenses", "Office Supplies", "Loan Repayment", "Miscellaneous"
];
const INCOME_CATEGORIES = [
  "Product Sales", "Service Revenue", "Consultation Fee", "Subscription",
  "Commission", "Rental Income", "Refund Received", "Investment Return", "Other Income"
];
const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN = (n: number) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });
const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

// ─── STAT CARD ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, growth }: any) {
  const isPositiveMetric = !label.toLowerCase().includes('expense');
  const isGrowthPositive = growth !== null && growth !== undefined && Number(growth) >= 0;
  const goodColor = isPositiveMetric ? isGrowthPositive : !isGrowthPositive;

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground font-mono leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      {growth !== null && growth !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${goodColor ? "text-emerald-600" : "text-rose-500"}`}>
          {isGrowthPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(Number(growth))}% vs previous period
        </div>
      )}
    </div>
  );
}

export default function Finance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === 'owner' || user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  // Date range filter
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [isFiltered, setIsFiltered] = useState(false);

  // Forms
  const [newExp, setNewExp] = useState({ category: "Rent / Lease", amount: "", description: "", date: today(), account: "Cash" });
  const [newInc, setNewInc] = useState({ category: "Product Sales", amount: "", description: "", date: today(), account: "Bank" });
  const [newSale, setNewSale] = useState({ product_id: "", lead_id: "", selling_price: "", sale_date: today(), account: "Bank" });
  const [showExpForm, setShowExpForm] = useState(false);
  const [showIncForm, setShowIncForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [addingExp, setAddingExp] = useState(false);
  const [addingInc, setAddingInc] = useState(false);
  const [addingSale, setAddingSale] = useState(false);
  const [resetting, setResetting] = useState(false);

  const buildParams = useCallback((extra = '') => {
    const base = `?from=${dateFrom}&to=${dateTo}`;
    return extra ? `${base}&${extra}` : base;
  }, [dateFrom, dateTo]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, exp, inc, sal, cf, prod, ld] = await Promise.all([
        fetch(`${API}/overview${buildParams()}`).then(r => r.json()),
        fetch(`${API}/expenses${buildParams()}`).then(r => r.json()),
        fetch(`${API}/income${buildParams()}`).then(r => r.json()),
        fetch(`${API}/sales${buildParams()}`).then(r => r.json()),
        fetch(`${API}/cashflow${buildParams()}`).then(r => r.json()),
        fetch("http://localhost:5001/api/products").then(r => r.json()),
        fetch("http://localhost:5001/api/leads").then(r => r.json()),
      ]);
      setOverview(ov);
      setExpenses(Array.isArray(exp) ? exp : []);
      setIncome(Array.isArray(inc) ? inc : []);
      setSales(Array.isArray(sal) ? sal : []);
      setCashflow(Array.isArray(cf) ? cf : []);
      setProducts(Array.isArray(prod) ? prod : []);
      setLeads(Array.isArray(ld) ? ld : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [buildParams]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const applyDateFilter = () => { setIsFiltered(true); fetchAll(); };
  const clearFilter = () => {
    setDateFrom(monthStart());
    setDateTo(today());
    setIsFiltered(false);
  };

  // Reset all financial data
  const handleReset = async () => {
    const step1 = confirm("⚠️ DANGER: This will permanently delete ALL financial records.\n\nThis includes:\n• All income entries\n• All expenses\n• All product sales\n• All orders\n• Entire cash flow ledger\n\nThis CANNOT be undone. Continue?");
    if (!step1) return;
    const code = prompt("Type RESET to confirm permanent deletion of all financial data:");
    if (code !== "RESET") { toast({ title: "Reset cancelled" }); return; }
    setResetting(true);
    try {
      const res = await fetch(`${API}/reset`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET_FINANCE" })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "✅ Financial data reset", description: "All records have been permanently deleted." });
        fetchAll();
      } else {
        toast({ title: "Reset failed", description: data.error, variant: "destructive" });
      }
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    setResetting(false);
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setAddingExp(true);
    const res = await fetch(`${API}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newExp) });
    if (res.ok) { toast({ title: "Expense recorded" }); setNewExp({ category: "Rent / Lease", amount: "", description: "", date: today(), account: "Cash" }); setShowExpForm(false); fetchAll(); }
    else toast({ title: "Failed", variant: "destructive" });
    setAddingExp(false);
  };

  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault(); setAddingInc(true);
    const res = await fetch(`${API}/income`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newInc) });
    if (res.ok) { toast({ title: "Income recorded" }); setNewInc({ category: "Product Sales", amount: "", description: "", date: today(), account: "Bank" }); setShowIncForm(false); fetchAll(); }
    else toast({ title: "Failed", variant: "destructive" });
    setAddingInc(false);
  };

  const addSale = async (e: React.FormEvent) => {
    e.preventDefault(); setAddingSale(true);
    const res = await fetch(`${API}/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newSale, payment_method: newSale.account }) });
    if (res.ok) { toast({ title: "Sale recorded" }); setNewSale({ product_id: "", lead_id: "", selling_price: "", sale_date: today(), account: "Bank" }); setShowSaleForm(false); fetchAll(); }
    else toast({ title: "Failed", variant: "destructive" });
    setAddingSale(false);
  };

  const deleteExpense  = async (id: number) => { if (!confirm("Delete?")) return; await fetch(`${API}/expenses/${id}`, { method: "DELETE" }); fetchAll(); };
  const deleteIncome   = async (id: number) => { if (!confirm("Delete?")) return; await fetch(`${API}/income/${id}`, { method: "DELETE" }); fetchAll(); };

  const bankBal = overview?.balances?.find((b: any) => b.account === "Bank")?.balance || 0;
  const cashBal = overview?.balances?.find((b: any) => b.account === "Cash")?.balance || 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground mt-1">Business financial dashboard — all income sources, expenses & profit</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchAll} className="gap-2 text-xs h-8">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          {canManage && (
            <Button
              variant="outline" size="sm" disabled={resetting}
              onClick={handleReset}
              className="gap-2 text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
            >
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
              Reset All Data
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <CalendarRange className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</span>
          </div>
          <div className="flex items-end gap-2 flex-wrap flex-1">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm w-40" />
            </div>
            <Button onClick={applyDateFilter} className="h-9 text-sm bg-primary text-white gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" /> Apply Filter
            </Button>
            {isFiltered && (
              <Button variant="outline" onClick={clearFilter} className="h-9 text-sm gap-1.5">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
          {isFiltered && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
              {dateFrom} → {dateTo}
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={fmt(overview?.periodRevenue)}
          sub={`Today: ${fmt(overview?.todaySales)}`}
          icon={TrendingUp} color="bg-indigo-500"
          growth={overview?.revenueGrowth}
        />
        <StatCard
          label="Total Expenses"
          value={fmt(overview?.periodExpenses)}
          sub={`All-time: ${fmt(overview?.totalExpenses)}`}
          icon={TrendingDown} color="bg-rose-500"
          growth={overview?.expenseGrowth}
        />
        <StatCard
          label="Net Profit"
          value={fmt(overview?.netProfit)}
          sub={`Margin: ${overview?.profitMargin}%`}
          icon={DollarSign}
          color={Number(overview?.netProfit) >= 0 ? "bg-emerald-500" : "bg-red-500"}
          growth={null}
        />
        <StatCard
          label="Order Revenue"
          value={fmt(overview?.orderRevenue)}
          sub={`${overview?.orderCount} order(s) | Avg: ${fmt(overview?.avgOrderValue)}`}
          icon={ShoppingBag} color="bg-amber-500"
          growth={null}
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Profit Margin",       value: `${overview?.profitMargin}%`,      color: "text-emerald-600" },
          { label: "Revenue Growth",       value: overview?.revenueGrowth !== null ? `${overview?.revenueGrowth}%` : "N/A", color: Number(overview?.revenueGrowth) >= 0 ? "text-emerald-600" : "text-rose-600" },
          { label: "Order Conversion",     value: `${overview?.orderConversion}%`,   color: "text-indigo-600" },
          { label: "Avg Order Value",      value: fmt(overview?.avgOrderValue),      color: "text-amber-600" },
        ].map((m, i) => (
          <div key={i} className="bg-white border border-border rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-semibold">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Bank Account", bal: bankBal, icon: Landmark, bg: "bg-blue-50", iconColor: "text-blue-600" },
          { label: "Cash Drawer", bal: cashBal, icon: Wallet, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
        ].map(({ label, bal, icon: Icon, bg, iconColor }) => (
          <div key={label} className={`border border-border rounded-xl p-5 flex items-center gap-4 ${bg}`}>
            <div className={`h-12 w-12 rounded-xl ${bg} border border-border flex items-center justify-center shrink-0`}>
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
              <p className="text-2xl font-bold font-mono text-foreground">{fmt(bal)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{Number(bal) >= 0 ? "Available balance" : "⚠️ Deficit"}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {overview?.incomeByMonth?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-border rounded-xl p-5">
            <p className="text-sm font-semibold mb-1">Revenue vs Expenses (Monthly)</p>
            <p className="text-xs text-muted-foreground mb-4">Last 12 months from cash flow</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={overview.incomeByMonth}>
                <defs>
                  <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revG)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expG)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {overview?.expByCategory?.length > 0 && (
            <div className="bg-white border border-border rounded-xl p-5">
              <p className="text-sm font-semibold mb-1">Expense Breakdown</p>
              <p className="text-xs text-muted-foreground mb-4">By category in selected period</p>
              <ResponsiveContainer width="100%" height={160}>
                <RePieChart>
                  <Pie data={overview.expByCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={65} innerRadius={38}>
                    {overview.expByCategory.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {overview.expByCategory.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[110px]">{c.category}</span>
                    </div>
                    <span className="font-mono font-semibold text-foreground">{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="expenses">
        <TabsList className="bg-background border border-border p-0.5 rounded-lg h-auto flex-wrap gap-0.5">
          <TabsTrigger value="expenses"  className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5 gap-1.5"><TrendingDown className="h-3 w-3" />Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="income"    className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5 gap-1.5"><TrendingUp className="h-3 w-3" />Income ({income.length})</TabsTrigger>
          <TabsTrigger value="sales"     className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5 gap-1.5"><Receipt className="h-3 w-3" />Product Sales ({sales.length})</TabsTrigger>
          <TabsTrigger value="cashflow"  className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5 gap-1.5"><Wallet className="h-3 w-3" />Cash Flow ({cashflow.length})</TabsTrigger>
          <TabsTrigger value="pl"        className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5 gap-1.5"><PieChart className="h-3 w-3" />P&L</TabsTrigger>
          <TabsTrigger value="balances"  className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-3 py-1.5 gap-1.5"><Landmark className="h-3 w-3" />Bank & Cash</TabsTrigger>
        </TabsList>

        {/* ── EXPENSES ── */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{expenses.length} records · Total: <span className="font-semibold text-rose-600">{fmt(expenses.reduce((s, e) => s + Number(e.amount), 0))}</span></p>
            <Button size="sm" onClick={() => setShowExpForm(v => !v)} className="h-8 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white">
              <Plus className="h-3 w-3" /> Add Expense
            </Button>
          </div>
          {showExpForm && (
            <form onSubmit={addExpense} className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Category</Label>
                <Select value={newExp.category} onValueChange={v => setNewExp(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Amount (Rs.)</Label>
                <Input required type="number" placeholder="0.00" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Description</Label>
                <Input value={newExp.description} onChange={e => setNewExp(p => ({ ...p, description: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Date</Label>
                <Input type="date" value={newExp.date} onChange={e => setNewExp(p => ({ ...p, date: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Paid From</Label>
                <Select value={newExp.account} onValueChange={v => setNewExp(p => ({ ...p, account: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank">Bank</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={addingExp} className="h-9 text-sm bg-rose-600 hover:bg-rose-700 text-white flex-1">
                  {addingExp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Expense"}
                </Button>
                <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setShowExpForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No expenses in this period.</TableCell></TableRow>
                ) : expenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell><Badge variant="outline" className="text-[10px] border-rose-200 text-rose-700 bg-rose-50">{e.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.date?.split('T')[0]}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.account || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-rose-600">{fmt(e.amount)}</TableCell>
                    <TableCell><button onClick={() => deleteExpense(e.id)} className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-md hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── INCOME ── */}
        <TabsContent value="income" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{income.length} records · Total: <span className="font-semibold text-emerald-600">{fmt(income.reduce((s, e) => s + Number(e.amount), 0))}</span></p>
            <Button size="sm" onClick={() => setShowIncForm(v => !v)} className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-3 w-3" /> Add Income
            </Button>
          </div>
          {showIncForm && (
            <form onSubmit={addIncome} className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Category</Label>
                <Select value={newInc.category} onValueChange={v => setNewInc(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOME_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Amount (Rs.)</Label>
                <Input required type="number" placeholder="0.00" value={newInc.amount} onChange={e => setNewInc(p => ({ ...p, amount: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Description</Label>
                <Input value={newInc.description} onChange={e => setNewInc(p => ({ ...p, description: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Date</Label>
                <Input type="date" value={newInc.date} onChange={e => setNewInc(p => ({ ...p, date: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Received To</Label>
                <Select value={newInc.account} onValueChange={v => setNewInc(p => ({ ...p, account: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Bank">Bank</SelectItem><SelectItem value="Cash">Cash</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={addingInc} className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
                  {addingInc ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Income"}
                </Button>
                <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setShowIncForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {income.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No income in this period.</TableCell></TableRow>
                ) : income.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell><Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">{e.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.date?.split('T')[0]}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.account}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600">{fmt(e.amount)}</TableCell>
                    <TableCell><button onClick={() => deleteIncome(e.id)} className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-md hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── PRODUCT SALES ── */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{sales.length} sales · Revenue: <span className="font-semibold text-indigo-600">{fmt(sales.reduce((s, e) => s + Number(e.selling_price), 0))}</span></p>
            <Button size="sm" onClick={() => setShowSaleForm(v => !v)} className="h-8 text-xs gap-1.5 bg-primary text-white">
              <Plus className="h-3 w-3" /> Record Sale
            </Button>
          </div>
          {showSaleForm && (
            <form onSubmit={addSale} className="border border-primary/20 bg-primary/5 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-primary font-semibold">Product</Label>
                <Select value={newSale.product_id} onValueChange={v => setNewSale(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.brand} · Rs.{fmtN(p.price)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-primary font-semibold">Customer (Lead)</Label>
                <Select value={newSale.lead_id} onValueChange={v => setNewSale(p => ({ ...p, lead_id: v }))}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select lead" /></SelectTrigger>
                  <SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-primary font-semibold">Selling Price</Label>
                <Input required type="number" value={newSale.selling_price} onChange={e => setNewSale(p => ({ ...p, selling_price: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-primary font-semibold">Date</Label>
                <Input type="date" value={newSale.sale_date} onChange={e => setNewSale(p => ({ ...p, sale_date: e.target.value }))} className="h-9 text-sm bg-white" />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit" disabled={addingSale} className="h-9 text-sm bg-primary text-white flex-1">
                  {addingSale ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Sale"}
                </Button>
                <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setShowSaleForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-right">Revenue</TableHead>
                <TableHead className="text-xs text-right">Cost</TableHead>
                <TableHead className="text-xs text-right">Profit</TableHead>
                <TableHead className="text-xs text-right">Margin</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No sales in this period.</TableCell></TableRow>
                ) : sales.map((s: any) => {
                  const cost = Number(s.purchase_price || 0) + Number(s.transport_cost || 0) + Number(s.repair_cost || 0) + Number(s.registration_fee || 0);
                  const profit = Number(s.selling_price) - cost;
                  const margin = Number(s.selling_price) > 0 ? ((profit / Number(s.selling_price)) * 100).toFixed(1) : '0.0';
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.product_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.sale_date?.split('T')[0]}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-indigo-600">{fmt(s.selling_price)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(cost)}</TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(profit)}</TableCell>
                      <TableCell className={`text-right text-xs font-semibold ${Number(margin) >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{margin}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── CASH FLOW ── */}
        <TabsContent value="cashflow" className="mt-4">
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader><TableRow className="bg-muted/30">
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {cashflow.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">No transactions in this period.</TableCell></TableRow>
                ) : cashflow.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${c.type === 'Income' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-rose-200 text-rose-700 bg-rose-50'}`}>
                        {c.type === 'Income' ? '↑ In' : '↓ Out'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.account}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.date?.split('T')[0]}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${c.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {c.type === 'Income' ? '+' : '-'}{fmt(c.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── P&L ── */}
        <TabsContent value="pl" className="mt-4 space-y-4">
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-sm">Profit & Loss Statement</h3>
              <p className="text-xs text-muted-foreground">Period: {dateFrom} → {dateTo}</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Gross Revenue",         value: overview?.periodRevenue, color: "text-emerald-600", bold: false },
                { label: "Total Expenses",        value: overview?.periodExpenses, color: "text-rose-600", bold: false },
                { label: "─────────────────────", value: null, color: "", bold: false, divider: true },
                { label: "Net Profit / (Loss)",   value: overview?.netProfit, color: Number(overview?.netProfit) >= 0 ? "text-emerald-700" : "text-rose-700", bold: true },
                { label: "Profit Margin",         value: null, label2: `${overview?.profitMargin}%`, color: "text-indigo-600", bold: false },
                { label: "─────────────────────", value: null, color: "", bold: false, divider: true },
                { label: "Order Revenue",         value: overview?.orderRevenue, color: "text-amber-600", bold: false },
                { label: "Order Count",           value: null, label2: `${overview?.orderCount} orders`, color: "text-amber-600", bold: false },
                { label: "Avg Order Value",       value: overview?.avgOrderValue, color: "text-amber-600", bold: false },
                { label: "─────────────────────", value: null, color: "", bold: false, divider: true },
                { label: "Bank Balance",          value: bankBal, color: "text-blue-600", bold: false },
                { label: "Cash Balance",          value: cashBal, color: "text-emerald-600", bold: false },
                { label: "Total Liquid Assets",   value: Number(bankBal) + Number(cashBal), color: "text-foreground", bold: true },
              ].map((row, i) => row.divider ? (
                <div key={i} className="px-6 py-1 bg-muted/20" />
              ) : (
                <div key={i} className={`flex items-center justify-between px-6 py-3.5 ${row.bold ? "bg-muted/30" : ""}`}>
                  <span className={`text-sm ${row.bold ? "font-bold" : "font-medium text-muted-foreground"}`}>{row.label}</span>
                  <span className={`font-mono font-semibold text-sm ${row.color} ${row.bold ? "text-base font-bold" : ""}`}>
                    {row.label2 ? row.label2 : row.value !== null ? fmt(row.value) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── BANK & CASH ── */}
        <BankCashTab bankBal={bankBal} cashBal={cashBal} onSuccess={fetchAll} canEdit={canManage} />
      </Tabs>
    </div>
  );
}

// ─── BANK & CASH TAB ─────────────────────────────────────────────────────────
function BankCashTab({ bankBal, cashBal, onSuccess, canEdit }: { bankBal: number; cashBal: number; onSuccess: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ account: 'Bank', type: 'add', amount: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selAcc, setSelAcc] = useState('Bank');

  const loadHistory = useCallback(() => {
    fetch(`${API}/balance/${selAcc}`)
      .then(r => r.json())
      .then(d => setHistory(d.transactions || []))
      .catch(console.error);
  }, [selAcc]);

  useEffect(() => { loadHistory(); }, [loadHistory, bankBal, cashBal]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/balance/adjust`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        toast({ title: form.type === 'add' ? '💰 Deposit Recorded' : '💸 Withdrawal Recorded', description: `${form.account} balance: Rs. ${Number(data.balance).toLocaleString()}` });
        setForm(f => ({ ...f, amount: '', description: '' }));
        onSuccess();
      } else { toast({ title: 'Error', description: data.error, variant: 'destructive' }); }
    } catch { toast({ title: 'Network error', variant: 'destructive' }); }
    setSaving(false);
  };

  const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;

  return (
    <TabsContent value="balances" className="mt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Bank Account', bal: bankBal, icon: Landmark, color: 'bg-blue-500', bg: 'border-blue-200 bg-blue-50', acc: 'Bank' },
          { label: 'Cash Drawer', bal: cashBal, icon: Wallet, color: 'bg-emerald-500', bg: 'border-emerald-200 bg-emerald-50', acc: 'Cash' },
        ].map(({ label, bal, icon: Icon, color, bg, acc }) => (
          <button key={acc} onClick={() => setSelAcc(acc)}
            className={`border rounded-xl p-5 text-left transition-all hover:shadow-md ${bg} ${selAcc === acc ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center`}><Icon className="h-4.5 w-4.5 text-white" /></div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            <p className="text-3xl font-bold font-mono">{fmt(bal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{Number(bal) < 0 ? "⚠️ Deficit" : "Click to view transactions"}</p>
          </button>
        ))}
      </div>

      {canEdit && (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Adjust Balance</h3>
            <span className="text-xs text-muted-foreground ml-1">— Owner / Admin only</span>
          </div>
          <form onSubmit={handleAdjust} className="p-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Account</Label>
              <Select value={form.account} onValueChange={v => setForm(f => ({ ...f, account: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Bank">Bank Account</SelectItem><SelectItem value="Cash">Cash Drawer</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="add">💰 Deposit / Add Money</SelectItem><SelectItem value="remove">💸 Withdrawal / Remove</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Amount (Rs.)</Label>
              <Input required type="number" min="1" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Description</Label>
              <Input placeholder="e.g. Initial balance, Cash deposit..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving || !form.amount}
                className={`h-9 text-sm gap-2 ${form.type === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {form.type === 'add' ? '+ Record Deposit' : '- Record Withdrawal'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">{selAcc} — Transaction History</h3>
        </div>
        <Table>
          <TableHeader><TableRow className="bg-muted/30">
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-muted-foreground">No transactions for {selAcc}.</TableCell></TableRow>
            ) : history.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${t.type === 'Income' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-rose-200 text-rose-700 bg-rose-50'}`}>
                    {t.type === 'Income' ? '↑ In' : '↓ Out'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{t.description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.date?.split('T')[0]}</TableCell>
                <TableCell className={`text-right font-mono text-sm font-semibold ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'Income' ? '+' : '-'} {fmt(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TabsContent>
  );
}
