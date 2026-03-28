import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Brain, Send, Loader2, Sparkles, TrendingUp, TrendingDown,
  ShoppingBag, Users, Package, Landmark, Wallet, RefreshCw,
  ChevronRight, Zap, BarChart3, AlertTriangle
} from "lucide-react";

const API = "http://localhost:5001/api/bitzy";

const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString()}`;

// Markdown renderer (bold, newlines)
function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function ChatBubble({ role, text, isNew }: { role: "user" | "bot"; text: string; isNew?: boolean }) {
  const isBot = role === "bot";
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isBot ? "" : "flex-row-reverse"}`}
    >
      {isBot && (
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <Brain className="h-4 w-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isBot
            ? "bg-white border border-border shadow-sm text-foreground"
            : "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"
        }`}
      >
        {isBot ? (
          <div className="space-y-1 whitespace-pre-line">
            {text.split('\n').map((line, i) => (
              <p key={i} className={line.startsWith('•') || line.match(/^\d\./) ? 'pl-2' : ''}>
                <MarkdownText text={line} />
              </p>
            ))}
          </div>
        ) : (
          <p>{text}</p>
        )}
      </div>
    </motion.div>
  );
}

const QUICK_QUESTIONS = [
  { icon: TrendingUp,   label: "Revenue overview",      q: "What is my total revenue and income?" },
  { icon: ShoppingBag,  label: "Orders status",         q: "Show me my orders summary and conversion rate" },
  { icon: BarChart3,    label: "Forecast next week",    q: "Predict my revenue for next week" },
  { icon: Package,      label: "Top products",          q: "What are my best selling products?" },
  { icon: TrendingDown, label: "Expense analysis",      q: "Analyze my expenses and biggest costs" },
  { icon: Users,        label: "Leads pipeline",        q: "How are my leads and customer conversions?" },
  { icon: Landmark,     label: "Bank balance",          q: "What are my current bank and cash balances?" },
  { icon: AlertTriangle,label: "Low stock alerts",      q: "Which products are low on stock?" },
];

export default function BitzyAIPage() {
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const chatEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const res = await fetch(`${API}/snapshot`);
      const data = await res.json();
      setSnapshot(data);
    } catch (e) { console.error(e); }
    setSnapshotLoading(false);
  }, []);

  useEffect(() => {
    loadSnapshot();
    // Welcome message
    setMessages([{
      role: "bot",
      text: "👋 Hi! I'm **BitzyAI**, your intelligent business assistant!\n\nI have full access to your real business data — orders, finance, leads, inventory, and more.\n\nAsk me anything about your business performance, or click a quick question below to get started! 🚀"
    }]);
  }, [loadSnapshot]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", text: data.reply || "I couldn't process that. Please try again." }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "❌ Could not connect to the server. Make sure the backend is running." }]);
    }
    setLoading(false);
    inputRef.current?.focus();
    scrollToBottom();
  };

  const s = snapshot?.summary;
  const p = snapshot?.predictions;

  const kpiCards = s ? [
    { label: "Total Revenue",   value: fmt(s.totalIncome),     icon: TrendingUp,   color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "Net Profit",      value: fmt(s.netProfit),        icon: BarChart3,    color: Number(s.netProfit) >= 0 ? "text-indigo-600" : "text-rose-600", bg: Number(s.netProfit) >= 0 ? "bg-indigo-50" : "bg-rose-50", border: Number(s.netProfit) >= 0 ? "border-indigo-200" : "border-rose-200" },
    { label: "Orders",          value: `${s.totalOrders}`,      icon: ShoppingBag,  color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    { label: "7-Day Forecast",  value: fmt(p?.weeklyForecast),  icon: Zap,          color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
    { label: "Bank Balance",    value: fmt(s.bankBalance),      icon: Landmark,     color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    { label: "Cash Balance",    value: fmt(s.cashBalance),      icon: Wallet,       color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
  ] : [];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-0 max-w-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
              BitzyAI
              <Badge className="text-[9px] bg-violet-100 text-violet-700 border-violet-200 font-semibold px-1.5 py-0.5">BETA</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Business Intelligence Assistant · Real-time data analysis</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadSnapshot} className="h-8 text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden pt-4">
        {/* Left: Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} text={m.text} isNew={i === messages.length - 1} />
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Brain className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="bg-white border border-border rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          {/* Quick questions */}
          <div className="shrink-0 pt-3 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Quick Questions
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_QUESTIONS.map(({ icon: Icon, label, q }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-white hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all disabled:opacity-50"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  <ChevronRight className="h-2.5 w-2.5 opacity-50" />
                </button>
              ))}
            </div>

            {/* Input */}
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(input); }}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me about revenue, orders, forecasts, inventory..."
                disabled={loading}
                className="flex-1 h-10 text-sm bg-white border-border focus:border-primary"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="h-10 w-10 p-0 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shrink-0 shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>

        {/* Right: Snapshot Panel */}
        <div className="w-64 shrink-0 overflow-y-auto space-y-3 hidden lg:block">


          {snapshotLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {kpiCards.map(({ label, value, icon: Icon, color, bg, border }) => (
                <div key={label} className={`border ${border} ${bg} rounded-xl p-3 flex items-center gap-3`}>
                  <div className={`h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider truncate">{label}</p>
                    <p className={`text-sm font-bold font-mono ${color} truncate`}>{value}</p>
                  </div>
                </div>
              ))}

              {/* Pending orders alert */}
              {s?.pending > 0 && (
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="border border-amber-200 bg-amber-50 rounded-xl p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Action Needed</p>
                  </div>
                  <p className="text-xs text-amber-700">
                    <strong>{s.pending}</strong> pending order{s.pending > 1 ? 's' : ''} awaiting approval
                  </p>
                  <button onClick={() => sendMessage("Tell me about my pending orders")} className="text-[10px] text-amber-600 font-semibold underline mt-1">
                    Ask BitzyAI →
                  </button>
                </motion.div>
              )}

              {/* Low stock alert */}
              {s?.lowStock > 0 && (
                <div className="border border-rose-200 bg-rose-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-3.5 w-3.5 text-rose-600" />
                    <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Low Stock</p>
                  </div>
                  <p className="text-xs text-rose-700"><strong>{s.lowStock}</strong> product{s.lowStock > 1 ? 's' : ''} running low</p>
                  <button onClick={() => sendMessage("Which products are low on stock?")} className="text-[10px] text-rose-600 font-semibold underline mt-1">
                    Ask BitzyAI →
                  </button>
                </div>
              )}

              {/* Top product */}
              {snapshot?.details?.topProducts?.[0] && (
                <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Top Product
                  </p>
                  <p className="text-xs font-semibold text-indigo-900 truncate">{snapshot.details.topProducts[0].name}</p>
                  <p className="text-[11px] text-indigo-600">{snapshot.details.topProducts[0].count} orders · {fmt(snapshot.details.topProducts[0].revenue)}</p>
                </div>
              )}

              {/* Profit margin */}
              {s && (
                <div className="border border-border rounded-xl p-3 bg-white">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Profit Margin</p>
                  <p className={`text-lg font-bold font-mono mt-0.5 ${Number(s.profitMargin) >= 20 ? 'text-emerald-600' : Number(s.profitMargin) >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>{s.profitMargin}%</p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${Number(s.profitMargin) >= 20 ? 'bg-emerald-500' : Number(s.profitMargin) >= 0 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, Number(s.profitMargin)))}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
