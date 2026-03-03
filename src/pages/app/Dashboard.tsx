import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  Users,
  ShoppingBag,
  TrendingUp,
  MessageCircle,
  Loader2,
  Zap,
  
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface DashboardData {
  revenue: number;
  totalContacts: number;
  totalOrders: number;
  avgTicket: number;
  estimatedPotential: number;
  ordersByMarketplace: { name: string; value: number }[];
  whatsappEngagement: { name: string; enviadas: number; recebidas: number }[];
  usage: { metric: string; current_value: number; limit_value: number | null }[];
  pendingJobs: number;
  failedJobs: number;
  
  monthlyRevenue: { name: string; faturamento: number }[];
}

const MARKETPLACE_COLORS: Record<string, string> = {
  "Shopee": "hsl(16, 100%, 50%)",        // laranja-avermelhado Shopee
  "Mercado Livre": "hsl(52, 100%, 50%)",  // amarelo ML
  "Amazon": "hsl(33, 100%, 50%)",         // laranja Amazon
  "Magalu": "hsl(210, 100%, 45%)",        // azul Magalu
  "TikTok": "hsl(152, 76%, 46%)",         // Verde TikTok (conforme solicitado)
  "Kwai": "hsl(25, 100%, 52%)",           // laranja Kwai
  "Direto": "hsl(152, 76%, 46%)",         // verde padrão do app
};

const getMarketplaceColor = (name: string): string =>
  MARKETPLACE_COLORS[name] || "hsl(220, 10%, 55%)";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const Dashboard = () => {
  const { tenantId, tenantName } = useTenant();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

    const [ordersRes, contactsRes, messagesRes, usageRes, jobsRes, allOrdersRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total_value, marketplace, order_date")
        .eq("tenant_id", tenantId)
        .gte("created_at", startOfMonth),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("messages")
        .select("direction, created_at")
        .eq("tenant_id", tenantId)
        .eq("channel", "whatsapp")
        .gte("created_at", startOfMonth),
      supabase
        .from("usage_tracking")
        .select("metric, current_value, limit_value")
        .eq("tenant_id", tenantId),
      supabase
        .from("job_queue")
        .select("status")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "failed"]),
      supabase
        .from("orders")
        .select("total_value, order_date, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", sixMonthsAgo),
    ]);

    const orders = ordersRes.data || [];
    const allOrders = allOrdersRes.data || [];
    const totalContacts = contactsRes.count || 0;
    const messages = messagesRes.data || [];
    const usage = (usageRes.data || []) as { metric: string; current_value: number; limit_value: number | null }[];
    const jobs = jobsRes.data || [];
    const pendingJobs = jobs.filter((j: any) => j.status === "pending").length;
    const failedJobs = jobs.filter((j: any) => j.status === "failed").length;
    

    const revenue = orders.reduce((sum, o) => sum + Number(o.total_value || 0), 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;
    const estimatedPotential = totalContacts * avgTicket * 0.15;

    // Orders by marketplace
    const marketplaceMap: Record<string, number> = {};
    orders.forEach((o) => {
      const mp = o.marketplace || "Direto";
      marketplaceMap[mp] = (marketplaceMap[mp] || 0) + 1;
    });
    const ordersByMarketplace = Object.entries(marketplaceMap).map(([name, value]) => ({ name, value }));

    // WhatsApp engagement by week
    const weekMap: Record<string, { enviadas: number; recebidas: number }> = {};
    messages.forEach((m) => {
      const d = new Date(m.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = `${weekStart.getDate().toString().padStart(2, "0")}/${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;
      if (!weekMap[key]) weekMap[key] = { enviadas: 0, recebidas: 0 };
      if (m.direction === "outbound") weekMap[key].enviadas++;
      else weekMap[key].recebidas++;
    });
    const whatsappEngagement = Object.entries(weekMap).map(([name, v]) => ({ name, ...v }));
    if (whatsappEngagement.length === 0) {
      whatsappEngagement.push(
        { name: "Sem. 1", enviadas: 0, recebidas: 0 },
        { name: "Sem. 2", enviadas: 0, recebidas: 0 },
        { name: "Sem. 3", enviadas: 0, recebidas: 0 },
        { name: "Sem. 4", enviadas: 0, recebidas: 0 }
      );
    }
    if (ordersByMarketplace.length === 0) {
      ordersByMarketplace.push({ name: "Nenhum", value: 0 });
    }

    // Monthly revenue (last 6 months)
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthlyMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthNames[d.getMonth()];
      monthlyMap[key] = 0;
    }
    allOrders.forEach((o) => {
      const d = new Date(o.order_date || o.created_at);
      const key = monthNames[d.getMonth()];
      if (key in monthlyMap) {
        monthlyMap[key] += Number(o.total_value || 0);
      }
    });
    const monthlyRevenue = Object.entries(monthlyMap).map(([name, faturamento]) => ({ name, faturamento }));

    setData({ revenue, totalContacts, totalOrders, avgTicket, estimatedPotential, ordersByMarketplace, whatsappEngagement, usage, pendingJobs, failedJobs, monthlyRevenue });
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: "Faturamento", value: formatCurrency(data?.revenue ?? 0), icon: DollarSign, color: "text-primary" },
    { label: "Clientes capturados", value: String(data?.totalContacts ?? 0), icon: Users, color: "text-blue-400" },
    { label: "Ticket médio", value: formatCurrency(data?.avgTicket ?? 0), icon: ShoppingBag, color: "text-amber-400" },
    { label: "Potencial estimado", value: formatCurrency(data?.estimatedPotential ?? 0), icon: TrendingUp, color: "text-purple-400" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao painel de {tenantName || "sua empresa"}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="font-display text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <Card className="border-border/50 mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Faturamento Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 76%, 46%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 76%, 46%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border) / 0.25)" strokeWidth={0.5} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="hsl(152, 76%, 46%)"
                  strokeWidth={2}
                  fill="url(#colorFaturamento)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Marketplace */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Pedidos por Marketplace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.ordersByMarketplace || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(data?.ordersByMarketplace || []).map((entry, i) => (
                      <Cell key={i} fill={getMarketplaceColor(entry.name)} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(220, 18%, 7%)",
                      border: "1px solid hsl(220, 14%, 14%)",
                      borderRadius: "8px",
                      color: "hsl(0, 0%, 95%)",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Engagement */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Engajamento WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.whatsappEngagement || []} barGap={4}>
                  <CartesianGrid stroke="hsl(var(--border) / 0.25)" strokeWidth={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                  <Bar dataKey="enviadas" fill="hsl(152, 76%, 46%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recebidas" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Usage & Jobs Monitor */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Monitoramento de Uso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Job queue status */}
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Jobs pendentes</span>
                  <Badge variant={data?.pendingJobs ? "default" : "secondary"} className="text-xs">
                    {data?.pendingJobs || 0}
                  </Badge>
                </div>
              </div>
            </div>
            {(data?.failedJobs ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">{data?.failedJobs} jobs falharam</span>
              </div>
            )}

            {/* Usage metrics */}
            {(data?.usage || []).length > 0 ? (
              data!.usage.map((u) => {
                const pct = u.limit_value ? Math.min(100, (u.current_value / u.limit_value) * 100) : 0;
                return (
                  <div key={u.metric}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground capitalize">{u.metric.replace(/_/g, " ")}</span>
                      <span className="text-xs font-medium">
                        {u.current_value}{u.limit_value ? ` / ${u.limit_value}` : ""}
                      </span>
                    </div>
                    {u.limit_value && (
                      <Progress value={pct} className="h-1.5" />
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados de uso registrados ainda.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Dashboard;
