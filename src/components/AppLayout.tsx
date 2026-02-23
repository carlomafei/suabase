import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useBranding } from "@/hooks/useBranding";
import {
  Database,
  LayoutDashboard,
  Users,
  ShoppingBag,
  Kanban,
  MessageCircle,
  Zap,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/app/contacts", icon: Users, label: "Contatos" },
  { to: "/app/orders", icon: ShoppingBag, label: "Pedidos" },
  { to: "/app/crm", icon: Kanban, label: "CRM" },
  { to: "/app/messages", icon: MessageCircle, label: "Mensagens" },
  { to: "/app/automations", icon: Zap, label: "Automações" },
  { to: "/app/settings", icon: Settings, label: "Configurações" },
];

const AppLayout = () => {
  const { signOut } = useAuth();
  const { tenantName } = useTenant();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="h-7 max-w-[120px] object-contain shrink-0" />
          ) : (
            <Database className="h-6 w-6 text-primary shrink-0" />
          )}
          {!collapsed && (
            <span className="font-display font-bold text-lg truncate">
              {branding.hide_platform_branding ? branding.platform_name : branding.platform_name || "Sua Base"}
            </span>
          )}
        </div>

        {/* Tenant name */}
        {!collapsed && tenantName && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground">Empresa</p>
            <p className="text-sm font-medium truncate">{tenantName}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-border space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors"
          >
            <ChevronLeft className={cn("h-5 w-5 shrink-0 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Recolher</span>}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center h-14 px-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 ml-3">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="h-5 max-w-[100px] object-contain" />
            ) : (
              <Database className="h-5 w-5 text-primary" />
            )}
            <span className="font-display font-bold">{branding.platform_name || "Sua Base"}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
