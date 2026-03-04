import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, DollarSign, Crown, Loader2, Search, ShieldOff,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getQualityLabel, formatCpf, getSourceLabel } from "@/lib/business-rules";
import { Progress } from "@/components/ui/progress";

interface ContactRow {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  whatsapp: string | null;
  email: string | null;
  total_spent: number;
  last_order_date: string | null;
  crm_stage: string | null;
  enriched_at: string | null;
  quality_score: number;
  opt_out_whatsapp: boolean;
  source: string | null;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const Contacts = () => {
  const { tenantId } = useTenant();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  

  const fetchContacts = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    // Fetch contacts + their orders aggregate + latest CRM deal stage
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("id, name, cpf_cnpj, whatsapp, email, enriched_at, created_at, quality_score, opt_out_whatsapp, source")
      .eq("tenant_id", tenantId)
      .order("name")
      .limit(500);

    if (!contactsData || contactsData.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = contactsData.map((c) => c.id);

    const [ordersRes, dealsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("contact_id, total_value, order_date")
        .eq("tenant_id", tenantId)
        .in("contact_id", contactIds),
      supabase
        .from("crm_deals")
        .select("contact_id, stage_id, crm_stages(name)")
        .eq("tenant_id", tenantId)
        .in("contact_id", contactIds)
        .order("updated_at", { ascending: false }),
    ]);

    const orders = ordersRes.data || [];
    const deals = dealsRes.data || [];

    // Aggregate orders per contact
    const orderAgg: Record<string, { total: number; lastDate: string | null }> = {};
    orders.forEach((o: any) => {
      if (!o.contact_id) return;
      if (!orderAgg[o.contact_id]) orderAgg[o.contact_id] = { total: 0, lastDate: null };
      orderAgg[o.contact_id].total += Number(o.total_value || 0);
      const d = o.order_date || o.created_at;
      if (d && (!orderAgg[o.contact_id].lastDate || d > orderAgg[o.contact_id].lastDate!))
        orderAgg[o.contact_id].lastDate = d;
    });

    // Latest CRM stage per contact
    const stageMap: Record<string, string> = {};
    deals.forEach((d: any) => {
      if (d.contact_id && !stageMap[d.contact_id]) {
        stageMap[d.contact_id] = (d as any).crm_stages?.name || "—";
      }
    });

    const rows: ContactRow[] = contactsData.map((c: any) => ({
      id: c.id,
      name: c.name,
      cpf_cnpj: c.cpf_cnpj,
      whatsapp: c.whatsapp,
      email: c.email,
      total_spent: orderAgg[c.id]?.total || 0,
      last_order_date: orderAgg[c.id]?.lastDate || null,
      crm_stage: stageMap[c.id] || null,
      enriched_at: c.enriched_at,
      quality_score: c.quality_score ?? 0,
      opt_out_whatsapp: c.opt_out_whatsapp ?? false,
      source: c.source ?? null,
    }));

    setContacts(rows);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);


  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.cpf_cnpj?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.whatsapp?.includes(q)
    );
  });

  const totalClients = contacts.length;
  const totalSpent = contacts.reduce((s, c) => s + c.total_spent, 0);
  const avgTicket = totalClients > 0 ? totalSpent / totalClients : 0;
  const topBuyer = contacts.length > 0
    ? contacts.reduce((top, c) => (c.total_spent > top.total_spent ? c : top), contacts[0])
    : null;

  const stats = [
    { label: "Total de clientes", value: String(totalClients), icon: Users, color: "text-primary" },
    { label: "Ticket médio/cliente", value: formatCurrency(avgTicket), icon: DollarSign, color: "text-amber-400" },
    { label: "Maior comprador", value: topBuyer ? topBuyer.name : "—", sub: topBuyer ? formatCurrency(topBuyer.total_spent) : "", icon: Crown, color: "text-purple-400" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-muted-foreground text-sm mt-1">Base de clientes capturados e enriquecidos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="font-display text-xl font-bold truncate">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="border-border/50 p-8 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">CPF/CNPJ</TableHead>
                  <TableHead className="text-xs">WhatsApp</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Total gasto</TableHead>
                  <TableHead className="text-xs">Qualidade</TableHead>
                  <TableHead className="text-xs">Origem</TableHead>
                  <TableHead className="text-xs">Status CRM</TableHead>
                  
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="border-border/50">
                    <TableCell className="text-xs font-medium max-w-[180px] truncate">
                      <div className="flex items-center gap-1.5">
                        {c.name}
                        {c.opt_out_whatsapp && (
                          <Tooltip>
                            <TooltipTrigger>
                              <ShieldOff className="h-3 w-3 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>Opt-out WhatsApp</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{c.cpf_cnpj ? formatCpf(c.cpf_cnpj) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.whatsapp ? (
                        <span className="text-primary">{c.whatsapp}</span>
                      ) : (
                        <span className="italic">Não enriquecido</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.email ? c.email : <span className="italic">Não enriquecido</span>}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium whitespace-nowrap">
                      {formatCurrency(c.total_spent)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const q = getQualityLabel(c.quality_score);
                        return (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={c.quality_score} className="h-1.5 w-14" />
                            <span className={`text-xs font-medium ${q.color}`}>{c.quality_score}%</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {getSourceLabel(c.source)}
                    </TableCell>
                    <TableCell>
                      {c.crm_stage ? (
                        <Badge variant="outline" className="text-xs">{c.crm_stage}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Contacts;
