import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useBranding } from "@/hooks/useBranding";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { usePlan } from "@/hooks/usePlan";
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
  Menu,
  BarChart3,
  Shield,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
  permission?: Permission;
};

const navItems: NavItem[] = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true, permission: "view_dashboard" },
  { to: "/app/orders", icon: ShoppingBag, label: "Pedidos", permission: "view_orders" },
  { to: "/app/contacts", icon: Users, label: "Clientes", permission: "view_contacts" },
  { to: "/app/crm", icon: Kanban, label: "Kanban", permission: "use_crm" },
  { to: "/app/automations", icon: Zap, label: "Automações", permission: "create_automations" },
  { to: "/app/messages", icon: MessageCircle, label: "WhatsApp", permission: "send_messages" },
  { to: "/app/analytics", icon: BarChart3, label: "Análises", permission: "view_metrics" },
  { to: "/app/settings", icon: Settings, label: "Configurações", permission: "manage_settings" },
];

const AppLayout = () => {
  const { signOut } = useAuth();
  const { tenantName } = useTenant();
  const { branding } = useBranding();
  const { can, isSuperAdmin } = usePermissions();
  const { currentPlan } = usePlan();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const visibleItems = navItems.filter(
    (item) => !item.permission || can(item.permission)
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex items-center h-12 px-4 gap-4">
          {/* Logo */}
          <NavLink to="/app" className="flex items-center gap-2 shrink-0 mr-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="h-6 max-w-[120px] object-contain" />
            ) : (
              <Database className="h-5 w-5 text-primary" />
            )}
            <span className="font-display font-bold text-base hidden sm:inline">
              {branding.platform_name || "Sua Base"}
            </span>
          </NavLink>

          {/* Plan badge */}
          {currentPlan && (
            <Badge variant="secondary" className="hidden sm:inline-flex text-xs font-medium bg-primary/15 text-primary border-primary/30 shrink-0">
              {currentPlan.name}
            </Badge>
          )}

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-end">
            {visibleItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}

            {isSuperAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-destructive text-destructive-foreground font-medium"
                      : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  )
                }
              >
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </NavLink>
            )}
          </nav>

          {/* Right side: Minha Conta + Sair */}
          <div className="hidden lg:flex items-center gap-2 ml-auto shrink-0">
            <NavLink
              to="/app/settings"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <User className="h-4 w-4" />
              <span>Minha Conta</span>
            </NavLink>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 h-8 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden ml-auto"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Accent line at bottom */}
        <div className="h-[1px] bg-border" />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-card border-l border-border p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-sm">{tenantName || "Menu"}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {currentPlan && (
              <Badge variant="secondary" className="mb-4 w-fit text-xs bg-primary/15 text-primary border-primary/30">
                {currentPlan.name}
              </Badge>
            )}

            <nav className="flex-1 space-y-1">
              {visibleItems.map(({ to, icon: Icon, label, end }) => (
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
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </NavLink>
              ))}

              {isSuperAdmin && (
                <>
                  <div className="my-3 border-t border-border" />
                  <NavLink
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Shield className="h-5 w-5" />
                    <span>Super Admin</span>
                  </NavLink>
                </>
              )}
            </nav>

            <div className="border-t border-border pt-3">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 w-full transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
