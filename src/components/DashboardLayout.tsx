import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, ShoppingCart, Package, MessageSquare,
  BarChart3, Brain, Settings, LogOut, ChevronLeft, ChevronRight, Zap, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { useBusiness } from "@/hooks/useBusiness";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Customers", icon: Users, path: "/dashboard/customers" },
  { label: "Orders", icon: ShoppingCart, path: "/dashboard/orders" },
  { label: "Products", icon: Package, path: "/dashboard/products" },
  { label: "Conversations", icon: MessageSquare, path: "/dashboard/conversations" },
  { label: "Analytics", icon: BarChart3, path: "/dashboard/analytics" },
  { label: "AI Insights", icon: Brain, path: "/dashboard/ai-insights" },
  { label: "Settings", icon: Settings, path: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { business } = useBusiness();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const sidebarWidth = collapsed ? "w-[68px]" : "w-64";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 p-4 border-b border-sidebar-border", collapsed && "justify-center")}>
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-bold text-sm truncate">{business?.name || "SmartBiz AI"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">Business Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              {active && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon className="h-5 w-5 shrink-0 relative z-10" />
              {!collapsed && <span className="relative z-10">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 w-full transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className={cn("hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300", sidebarWidth)}>
          <SidebarContent />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute bottom-4 -right-3 z-50 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
            style={{ left: collapsed ? "calc(68px - 12px)" : "calc(256px - 12px)" }}
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <motion.aside
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            className="relative w-64 bg-sidebar border-r border-sidebar-border z-50"
          >
            <SidebarContent />
          </motion.aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h2 className="font-display font-semibold text-lg">
            {navItems.find(n => n.path === location.pathname)?.label || "Dashboard"}
          </h2>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
