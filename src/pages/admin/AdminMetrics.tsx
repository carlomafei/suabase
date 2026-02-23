import { Building2, Users, TrendingUp, DollarSign } from "lucide-react";

const AdminMetrics = () => (
  <div>
    <div className="mb-8">
      <h1 className="font-display text-2xl md:text-3xl font-bold">Métricas Globais</h1>
      <p className="text-muted-foreground mt-1">Visão geral da plataforma</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[
        { label: "Total Tenants", value: "0", icon: Building2 },
        { label: "Usuários Ativos", value: "0", icon: Users },
        { label: "MRR", value: "R$ 0", icon: TrendingUp },
        { label: "Receita Total", value: "R$ 0", icon: DollarSign },
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
      <p className="text-muted-foreground">Dados consolidados da plataforma aparecerão aqui.</p>
    </div>
  </div>
);

export default AdminMetrics;
