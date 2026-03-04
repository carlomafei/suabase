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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  MessageCircle,
  Loader2,
  CalendarIcon,
  Filter,
  ShoppingBag,
  RefreshCw,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Package,
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
  metadata?: { numero_loja_virtual?: string; bling_numero?: string } | null;
  contact_name?: string;
  contact_cpf?: string;
  contact_whatsapp?: string;
}

interface ContactDetail {
  name: string;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  metadata: {
    endereco?: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cep?: string;
      municipio?: string;
      uf?: string;
    };
  } | null;
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

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
        metadata: o.metadata,
        contact_name: o.contacts?.name,
        contact_cpf: o.contacts?.cpf_cnpj,
        contact_whatsapp: o.contacts?.whatsapp,
      }))
    );
    setLoading(false);
  }, [tenantId, dateRange, filterMarketplace, filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Fetch contact detail when selecting an order
  const handleSelectOrder = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setContactDetail(null);
    if (!order.contact_id) return;

    setLoadingContact(true);
    try {
      const { data } = await supabase
        .from("contacts")
        .select("name, cpf_cnpj, email, phone, whatsapp, metadata")
        .eq("id", order.contact_id)
        .single();

      if (data) {
        setContactDetail(data as ContactDetail);
      }
    } catch (err) {
      console.error("Failed to fetch contact detail:", err);
    } finally {
      setLoadingContact(false);
    }
  }, []);

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

  const endereco = contactDetail?.metadata?.endereco;
  const safeRua = endereco?.endereco && typeof endereco.endereco === 'string' ? endereco.endereco : "";
  const enderecoStr = endereco
    ? [
        [safeRua, endereco.numero].filter(Boolean).join(", "),
        endereco.complemento,
        endereco.bairro,
        [endereco.municipio, endereco.uf].filter(Boolean).join(" - "),
        endereco.cep ? `CEP: ${endereco.cep}` : null,
      ].filter(Boolean).join("\n")
    : null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          
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
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-sm gap-2 h-9 w-[160px] justify-start">
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
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              locale={ptBR}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Select value={filterMarketplace} onValueChange={setFilterMarketplace}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Marketplace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {MARKETPLACE_OPTIONS.map((mp) => (
              <SelectItem key={mp} value={mp}>{mp}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
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
            Limpar
          </Button>
        )}
      </div>

      {/* Main content: table + detail panel */}
      <div>
        {/* Table */}
        <div>
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
                      <TableHead className="text-xs text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const mpStyle = getMarketplaceStyle(order.marketplace);
                      const status = getStatus(order.status);
                      const orderDate = order.order_date || order.created_at;
                      const isSelected = selectedOrder?.id === order.id;

                      return (
                        <TableRow
                          key={order.id}
                          className={cn(
                            "border-border/50 transition-colors",
                            isSelected && "bg-accent"
                          )}
                        >
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(orderDate), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {(order.metadata as any)?.numero_loja_virtual || order.external_id || order.id.slice(0, 8)}
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
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleSelectOrder(order)}
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
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

        {/* Detail Sidebar Overlay */}
        {selectedOrder && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedOrder(null)} />
            <div className="fixed inset-y-0 right-0 w-[400px] max-w-[90vw] z-50 bg-background border-l border-border shadow-lg flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
                <h3 className="font-semibold text-sm">Detalhes do Pedido</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrder(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  {/* Order Info */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Pedido</p>
                    <p className="text-sm font-mono font-medium">
                      #{(selectedOrder.metadata as any)?.numero_loja_virtual || selectedOrder.external_id || selectedOrder.id.slice(0, 8)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={getStatus(selectedOrder.status).variant} className="text-xs">
                        {getStatus(selectedOrder.status).label}
                      </Badge>
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", getMarketplaceStyle(selectedOrder.marketplace).bg, getMarketplaceStyle(selectedOrder.marketplace).text)}>
                        {selectedOrder.marketplace || "Direto"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {format(new Date(selectedOrder.order_date || selectedOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  <Separator />

                  {/* Contact Info */}
                  {loadingContact ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : contactDetail ? (
                    <>
                      {/* Client - Bling data */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</p>
                        </div>
                        <p className="text-sm font-medium">{contactDetail.name}</p>
                        {contactDetail.cpf_cnpj && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{contactDetail.cpf_cnpj}</p>
                        )}
                        {contactDetail.phone && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <Phone className="h-3 w-3 inline mr-1" />{contactDetail.phone}
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Contact - Data Broker data */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contato</p>
                        </div>

                        {contactDetail.whatsapp ? (
                          <div className="flex items-center gap-2 mb-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 text-primary hover:text-primary"
                              onClick={() => handleWhatsApp(contactDetail.whatsapp)}
                            >
                              <MessageCircle className="h-3 w-3" />
                              {contactDetail.whatsapp}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">WhatsApp não disponível</p>
                        )}

                        {contactDetail.email ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <a href={`mailto:${contactDetail.email}`} className="text-xs text-primary hover:underline">
                              {contactDetail.email}
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">E-mail não disponível</p>
                        )}
                      </div>

                      <Separator />

                      {/* Address - Bling registry */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Endereço</p>
                        </div>

                        {endereco && enderecoStr ? (
                          <div className="text-xs space-y-0.5">
                            {endereco.endereco && (
                              <p>{[endereco.endereco, endereco.numero].filter(Boolean).join(", ")}</p>
                            )}
                            {endereco.complemento && <p>{endereco.complemento}</p>}
                            {endereco.bairro && <p>{endereco.bairro}</p>}
                            {(endereco.municipio || endereco.uf) && (
                              <p>{[endereco.municipio, endereco.uf].filter(Boolean).join(" - ")}</p>
                            )}
                            {endereco.cep && <p className="text-muted-foreground">CEP: {endereco.cep}</p>}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Endereço não disponível. Sincronize novamente para buscar do cadastro Bling.</p>
                        )}
                      </div>
                    </>
                  ) : selectedOrder.contact_id ? (
                    <p className="text-xs text-muted-foreground">Erro ao carregar dados do contato.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum contato vinculado a este pedido.</p>
                  )}

                  <Separator />

                  {/* Order Items */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens do Pedido</p>
                    </div>

                    {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                      <div className="space-y-2">
                        {selectedOrder.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {item.descricao || item.nome || item.description || item.name || "Produto"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Qtd: {item.quantidade || item.qty || 1}
                              </p>
                            </div>
                            <p className="text-xs font-medium whitespace-nowrap">
                              {formatCurrency((item.valor || item.valorUnidade || item.price || 0) * (item.quantidade || item.qty || 1))}
                            </p>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-xs font-semibold">Total</p>
                          <p className="text-sm font-bold text-primary">{formatCurrency(selectedOrder.total_value)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum item encontrado.</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Orders;