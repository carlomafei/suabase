import { useEffect, useState } from "react";
import { Building2, Users, TrendingUp, DollarSign, Loader2, Contact } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Metrics {
  total_tenants: number;
  total_users: number;
  total_contacts: number;
  mrr: number;
}

const AdminMetrics = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("admin-api", {
        body: { action: "global_metrics" },
      });
      if (res.data?.metrics) setMetrics(res.data.metrics);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    { label: "Total Tenants", value: String(metrics?.total_tenants ?? 0), icon: Building2 },
    { label: "Usuários Ativos", value: String(metrics?.total_users ?? 0), icon: Users },
    { label: "Contatos", value: String(metrics?.total_contacts ?? 0), icon: Contact },
    {
      label: "MRR",
      value: `R$ ${(metrics?.mrr ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Métricas Globais</h1>
        <p className="text-muted-foreground mt-1">Visão geral da plataforma</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card-gradient rounded-xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminMetrics;
