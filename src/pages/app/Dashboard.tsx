import { useTenant } from "@/hooks/useTenant";
import { Users, ShoppingBag, MessageCircle, TrendingUp } from "lucide-react";

const stats = [
  { label: "Contatos", value: "0", icon: Users, change: "+0%" },
  { label: "Pedidos", value: "0", icon: ShoppingBag, change: "+0%" },
  { label: "Mensagens", value: "0", icon: MessageCircle, change: "+0%" },
  { label: "Recompra", value: "0%", icon: TrendingUp, change: "+0%" },
];

const Dashboard = () => {
  const { tenantName } = useTenant();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao painel de {tenantName || "sua empresa"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, change }) => (
          <div key={label} className="card-gradient rounded-xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-primary mt-1">{change} este mês</p>
          </div>
        ))}
      </div>

      <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
        <p className="text-muted-foreground">
          Configure suas integrações em <strong className="text-foreground">Configurações</strong> para começar a sincronizar pedidos e contatos.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
