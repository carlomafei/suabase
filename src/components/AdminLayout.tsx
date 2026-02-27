import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield,
  Building2,
  CreditCard,
  Receipt,
  BarChart3,
  DollarSign,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { to: "/admin", icon: BarChart3, label: "Métricas Globais", end: true },
  { to: "/admin/tenants", icon: Building2, label: "Tenants" },
  { to: "/admin/plans", icon: CreditCard, label: "Planos" },
  { to: "/admin/subscriptions", icon: Receipt, label: "Assinaturas" },
  { to: "/admin/billing", icon: DollarSign, label: "Faturamento" },
];

const AdminLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="sticky top-0 left-0 h-screen w-60 flex flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
          <Shield className="h-6 w-6 text-destructive shrink-0" />
          <span className="font-display font-bold text-lg">Super Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {adminNavItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-destructive/10 text-destructive font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-border space-y-1">
          <button
            onClick={() => navigate("/app")}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span>Voltar ao App</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
