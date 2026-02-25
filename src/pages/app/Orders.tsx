import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Eye,
  MessageCircle,
  Loader2,
  CalendarIcon,
  Filter,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Order {
  id: string;
  external_id: string | null;
  contact_id: string | null;
  total_value: number;
  status: string;
  marketplace: string | null;
  order_date: string | null;
  created_at: string;
  items?: any;
  contact_name?: string;
  contact_cpf?: string;
  contact_whatsapp?: string;
}

const MARKETPLACE_COLORS: Record<string, { bg: string; text: string }> = {
  shopee: { bg: "bg-[#EE4D2D]/15", text: "text-[#EE4D2D]" },
  "mercado livre": { bg: "bg-[#FFE600]/15", text: "text-[#D4AC0D]" },
  mercadolivre: { bg: "bg-[#FFE600]/15", text: "text-[#D4AC0D]" },
  amazon: { bg: "bg-[#FF9900]/15", text: "text-[#FF9900]" },
  magalu: { bg: "bg-[#0086FF]/15", text: "text-[#0086FF]" },
  "magazine luiza": { bg: "bg-[#0086FF]/15", text: "text-[#0086FF]" },
  tiktok: { bg: "bg-[#00F2EA]/15", text: "text-[#00F2EA]" },
  "tiktok shop": { bg: "bg-[#00F2EA]/15", text: "text-[#00F2EA]" },
  kwai: { bg: "bg-[#FF7E29]/15", text: "text-[#FF7E29]" },
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  processing: { label: "Processando", variant: "outline" },
  shipped: { label: "Enviado", variant: "default" },
  delivered: { label: "Entregue", variant: "default" },
  canceled: { label: "Cancelado", variant: "destructive" },
  returned: { label: "Devolvido", variant: "destructive" },
};

const MARKETPLACE_OPTIONS = ["Shopee", "Mercado Livre", "Amazon", "Magalu", "TikTok", "Kwai"];
const STATUS_OPTIONS = ["pending", "processing", "shipped", "delivered", "canceled", "returned"];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const Orders = () => {
  const { tenantId } = useTenant();
  const { isBlingOAuthConnected } = useIntegrations();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filterMarketplace, setFilterMarketplace] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const handleBlingSync = useCallback(async () => {
    if (!tenantId || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bling-sync', {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast.success(`Sincronizado: ${data?.synced ?? 0} novos, ${data?.updated ?? 0} atualizados`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar com o Bling");
    } finally {
      setSyncing(false);
    }
  }, [tenantId, syncing]);

  const fetchOrders = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    let query = supabase
      .from("orders")
      .select("*, contacts(name, cpf_cnpj, whatsapp)")

      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (dateRange?.from) {
      query = query.gte("created_at", dateRange.from.toISOString());
    }
    if (dateRange?.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endOfDay.toISOString());
    }
    if (filterMarketplace !== "all") {
      query = query.ilike("marketplace", `%${filterMarketplace}%`);
    }
    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data } = await query;

    setOrders(
      (data || []).map((o: any) => ({
        id: o.id,
        external_id: o.external_id,
        contact_id: o.contact_id,
        total_value: o.total_value,
        status: o.status,
        marketplace: o.marketplace,
        order_date: o.order_date,
        created_at: o.created_at,
        items: o.items,
        contact_name: o.contacts?.name,
        contact_cpf: o.contacts?.cpf_cnpj,
        contact_whatsapp: o.contacts?.whatsapp,
      }))
    );
    setLoading(false);
  }, [tenantId, dateRange, filterMarketplace, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const getMarketplaceStyle = (mp: string | null) => {
    if (!mp) return { bg: "bg-secondary", text: "text-secondary-foreground" };
    const key = mp.toLowerCase();
    return MARKETPLACE_COLORS[key] || { bg: "bg-secondary", text: "text-secondary-foreground" };
  };

  const getStatus = (s: string) => STATUS_MAP[s] || { label: s, variant: "secondary" as const };

  const handleWhatsApp = (whatsapp: string | null) => {
    if (!whatsapp) return;
    const num = whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground text-sm mt-1">Pedidos sincronizados dos marketplaces</p>
        </div>
        <div className="flex items-center gap-2">
          {isBlingOAuthConnected() && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleBlingSync}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Sincronizar Bling
            </Button>
          )}
          <Badge variant="secondary" className="w-fit text-xs">
            <ShoppingBag className="h-3 w-3 mr-1" />
            {orders.length} pedido{orders.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-2 h-9">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  )
                ) : (
                  "Período"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* Marketplace */}
          <Select value={filterMarketplace} onValueChange={setFilterMarketplace}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Marketplace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MARKETPLACE_OPTIONS.map((mp) => (
                <SelectItem key={mp} value={mp}>{mp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_MAP[s]?.label || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(dateRange || filterMarketplace !== "all" || filterStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => { setDateRange(undefined); setFilterMarketplace("all"); setFilterStatus("all"); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-border/50 p-8 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
          <p className="text-xs text-muted-foreground mt-1">Configure a integração com o Bling para sincronizar pedidos.</p>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">ID Pedido</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs">CPF/CNPJ</TableHead>
                  <TableHead className="text-xs">Marketplace</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const mpStyle = getMarketplaceStyle(order.marketplace);
                  const status = getStatus(order.status);
                  const orderDate = order.order_date || order.created_at;

                  return (
                    <TableRow key={order.id} className="border-border/50">
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(orderDate), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {order.external_id || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[160px] truncate">
                        {order.contact_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={
                        Array.isArray(order.items)
                          ? order.items.map((i: any) => i.descricao || i.nome || i.description || i.name).filter(Boolean).join(", ")
                          : "—"
                      }>
                        {Array.isArray(order.items)
                          ? order.items.map((i: any) => i.descricao || i.nome || i.description || i.name).filter(Boolean).join(", ") || "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {order.contact_cpf || "—"}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", mpStyle.bg, mpStyle.text)}>
                          {order.marketplace || "Direto"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium whitespace-nowrap">
                        {formatCurrency(order.total_value)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {order.contact_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Ver cliente"
                              onClick={() => navigate(`/app/contacts`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {order.contact_whatsapp && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary"
                              title="Enviar WhatsApp"
                              onClick={() => handleWhatsApp(order.contact_whatsapp!)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Orders;
