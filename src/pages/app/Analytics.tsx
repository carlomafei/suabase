import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  Smile, Meh, Frown, TrendingUp, MessageCircle, ShoppingBag, Loader2, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "hsl(152, 76%, 46%)",
  "hsl(45, 90%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(200, 70%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(35, 90%, 55%)",
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(0, 0%, 95%)",
  fontSize: "12px",
};

const Analytics = () => {
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [sentiment, setSentiment] = useState({ positive: 0, neutral: 0, negative: 0 });
  const [responseRate, setResponseRate] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [marketplacePerf, setMarketplacePerf] = useState<{ name: string; pedidos: number; faturamento: number }[]>([]);

  const fetchData = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const [messagesRes, ordersRes, contactsRes, dealsRes] = await Promise.all([
      supabase.from("messages").select("direction, status, sentiment").eq("tenant_id", tenantId).eq("channel", "whatsapp"),
      supabase.from("orders").select("marketplace, total_value, status").eq("tenant_id", tenantId),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("crm_deals").select("stage_id, crm_stages(name)").eq("tenant_id", tenantId),
    ]);

    const msgs = messagesRes.data || [];
    const orders = ordersRes.data || [];
    const totalContacts = contactsRes.count || 0;
    const deals = dealsRes.data || [];

    // Sentiment
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    msgs.forEach((m: any) => {
      if (m.sentiment === "positive") sentimentCounts.positive++;
      else if (m.sentiment === "negative") sentimentCounts.negative++;
      else if (m.direction === "inbound") sentimentCounts.neutral++;
    });
    setSentiment(sentimentCounts);

    // Response rate
    const outbound = msgs.filter((m: any) => m.direction === "outbound").length;
    const inbound = msgs.filter((m: any) => m.direction === "inbound").length;
    setResponseRate(outbound > 0 ? Math.round((inbound / outbound) * 100) : 0);

    // Conversion rate
    const converted = deals.filter((d: any) => (d as any).crm_stages?.name?.toLowerCase().includes("conversão")).length;
    setConversionRate(totalContacts > 0 ? Math.round((converted / totalContacts) * 100) : 0);

    // Marketplace performance
    const mpMap: Record<string, { pedidos: number; faturamento: number }> = {};
    orders.forEach((o: any) => {
      const mp = o.marketplace || "Direto";
      if (!mpMap[mp]) mpMap[mp] = { pedidos: 0, faturamento: 0 };
      mpMap[mp].pedidos++;
      mpMap[mp].faturamento += Number(o.total_value || 0);
    });
    setMarketplacePerf(Object.entries(mpMap).map(([name, v]) => ({ name, ...v })));

    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalSentiment = sentiment.positive + sentiment.neutral + sentiment.negative;
  const sentimentData = [
    { name: "Positivo", value: sentiment.positive, color: "hsl(152, 76%, 46%)" },
    { name: "Neutro", value: sentiment.neutral, color: "hsl(45, 90%, 55%)" },
    { name: "Negativo", value: sentiment.negative, color: "hsl(0, 84%, 60%)" },
  ];

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const kpis = [
    {
      label: "Sentimento Positivo",
      value: totalSentiment > 0 ? `${Math.round((sentiment.positive / totalSentiment) * 100)}%` : "—",
      icon: Smile,
      color: "text-primary",
    },
    {
      label: "Taxa de Resposta",
      value: `${responseRate}%`,
      icon: MessageCircle,
      color: "text-blue-400",
    },
    {
      label: "Taxa de Conversão",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      label: "Marketplaces Ativos",
      value: String(marketplacePerf.length),
      icon: ShoppingBag,
      color: "text-amber-400",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Análises</h1>
        <p className="text-muted-foreground text-sm mt-1">Métricas de sentimento, resposta, conversão e performance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="font-display text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Smile className="h-4 w-4 text-primary" />
              Classificação de Sentimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {totalSentiment === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Sem dados de sentimento ainda
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {sentimentData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" formatter={(v: string) => <span className="text-xs text-muted-foreground">{v}</span>} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Performance */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Performance por Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {marketplacePerf.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Sem dados de pedidos ainda
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketplacePerf} barGap={4}>
                    <CartesianGrid stroke="hsl(var(--border) / 0.25)" strokeWidth={0.5} />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: any, name: string) => [name === "faturamento" ? formatCurrency(value) : value, name === "faturamento" ? "Faturamento" : "Pedidos"]} />
                    <Legend iconType="circle" formatter={(v: string) => <span className="text-xs text-muted-foreground">{v === "pedidos" ? "Pedidos" : "Faturamento"}</span>} />
                    <Bar yAxisId="left" dataKey="pedidos" fill="hsl(152, 76%, 46%)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="faturamento" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Response & Conversion Gauges */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Taxas de Resposta e Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-4">
              {/* Response rate gauge */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke="hsl(200, 70%, 50%)"
                      strokeWidth="10"
                      strokeDasharray={`${responseRate * 3.14} ${314 - responseRate * 3.14}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-2xl font-bold">{responseRate}%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Taxa de Resposta</p>
                  <p className="text-xs text-muted-foreground">Mensagens respondidas / enviadas</p>
                </div>
              </div>

              {/* Conversion rate gauge */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke="hsl(152, 76%, 46%)"
                      strokeWidth="10"
                      strokeDasharray={`${conversionRate * 3.14} ${314 - conversionRate * 3.14}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-2xl font-bold">{conversionRate}%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Taxa de Conversão</p>
                  <p className="text-xs text-muted-foreground">Deals convertidos / total contatos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
