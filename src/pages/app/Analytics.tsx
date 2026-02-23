import { BarChart3, TrendingUp, Users, ShoppingBag } from "lucide-react";

const Analytics = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Análises</h1>
        <p className="text-muted-foreground mt-1">
          Métricas e relatórios do seu negócio
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Taxa de Conversão", value: "0%", icon: TrendingUp },
          { label: "Ticket Médio", value: "R$ 0", icon: ShoppingBag },
          { label: "Contatos Ativos", value: "0", icon: Users },
          { label: "Engajamento", value: "0%", icon: BarChart3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card-gradient rounded-xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
        <p className="text-muted-foreground">
          Os gráficos e relatórios detalhados aparecerão aqui conforme seus dados são processados.
        </p>
      </div>
    </div>
  );
};

export default Analytics;
