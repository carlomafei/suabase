import { useEffect, useState, useCallback } from "react";
import { formatCpf } from "@/lib/business-rules";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, DollarSign, GripVertical, User, Settings2, Check, MessageCircle, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#6366f1",
  "#a855f7", "#64748b",
];

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  position: number;
  stage_id: string;
  contact_id: string | null;
  contact_name?: string;
  contact_whatsapp?: string;
  contact_cpf_cnpj?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const StageSettingsPopover = ({ stage, onSave }: { stage: Stage; onSave: (id: string, name: string, color: string) => void }) => {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [open, setOpen] = useState(false);

  useEffect(() => { setName(stage.name); setColor(stage.color); }, [stage.name, stage.color]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(stage.id, name.trim(), color);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título da fase</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cor do fundo do cabeçalho</label>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    "w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" className="w-full h-8 text-xs" onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const CRM = () => {
  const { tenantId } = useTenant();
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const [stagesRes, dealsRes] = await Promise.all([
      supabase
        .from("crm_stages")
        .select("id, name, position, color")
        .eq("tenant_id", tenantId)
        .order("position"),
      supabase
        .from("crm_deals")
        .select("id, title, value, position, stage_id, contact_id, contacts(name, whatsapp, cpf_cnpj)")
        .eq("tenant_id", tenantId)
        .order("position"),
    ]);

    setStages((stagesRes.data || []) as Stage[]);
    setDeals(
      (dealsRes.data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        position: d.position,
        stage_id: d.stage_id,
        contact_id: d.contact_id,
        contact_name: d.contacts?.name,
        contact_whatsapp: d.contacts?.whatsapp,
        contact_cpf_cnpj: d.contacts?.cpf_cnpj,
      }))
    );
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStageUpdate = async (stageId: string, name: string, color: string) => {
    setStages((prev) => prev.map((s) => s.id === stageId ? { ...s, name, color } : s));
    const { error } = await supabase
      .from("crm_stages")
      .update({ name, color })
      .eq("id", stageId);
    if (error) {
      toast.error("Erro ao atualizar fase");
      fetchData();
    } else {
      toast.success("Fase atualizada");
    }
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedDeal || draggedDeal.stage_id === targetStageId) {
      setDraggedDeal(null);
      return;
    }

    // Optimistic update
    const targetStageDeals = deals.filter((d) => d.stage_id === targetStageId);
    const newPosition = targetStageDeals.length;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === draggedDeal.id
          ? { ...d, stage_id: targetStageId, position: newPosition }
          : d
      )
    );

    const { error } = await supabase
      .from("crm_deals")
      .update({ stage_id: targetStageId, position: newPosition, updated_at: new Date().toISOString() })
      .eq("id", draggedDeal.id);

    if (error) {
      toast.error("Erro ao mover deal");
      fetchData();
    } else {
      const targetStage = stages.find((s) => s.id === targetStageId);
      toast.success(`${draggedDeal.title} movido para ${targetStage?.name}`);
    }

    setDraggedDeal(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>

      {/* Summary */}
      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage_id === stage.id);
          const totalValue = stageDeals.reduce((s, d) => s + Number(d.value || 0), 0);
          return (
            <div key={stage.id} className="flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="text-xs text-muted-foreground">{stage.name}</span>
              <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
              <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {stages.map((stage) => {
          const stageDeals = deals
            .filter((d) => d.stage_id === stage.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={stage.id}
              className={cn(
                "flex flex-col w-[280px] min-w-[280px] rounded-xl border border-border/50 bg-card/50 transition-colors",
                dragOverStage === stage.id && "border-primary/50 bg-primary/5"
              )}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column header */}
              <div
                className="flex items-center gap-2 p-3 border-b border-border/50 rounded-t-xl"
                style={{ backgroundColor: stage.color }}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="font-display font-semibold text-sm flex-1 text-white">{stage.name}</span>
                <Badge variant="secondary" className="text-xs text-white bg-white/20 border-0">{stageDeals.length}</Badge>
                <StageSettingsPopover stage={stage} onSave={handleStageUpdate} />
              </div>

              {/* Stage total value */}
              <div className="px-2 pt-1.5">
                <div
                  className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold rounded-md"
                  style={{ backgroundColor: `${stage.color}18` }}
                >
                  <span className="uppercase tracking-wider" style={{ color: stage.color }}>Valor da Compra</span>
                  <span style={{ color: stage.color }}>
                    {formatCurrency(stageDeals.reduce((s, d) => s + Number(d.value || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {stageDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={() => handleDragStart(deal)}
                    className={cn(
                      "p-3 cursor-grab active:cursor-grabbing border-border/50 hover:border-primary/30 transition-all",
                      draggedDeal?.id === deal.id && "opacity-40 scale-95"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">{deal.contact_name || deal.title}</p>
                        </div>
                        {deal.contact_cpf_cnpj ? (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{formatCpf(deal.contact_cpf_cnpj)}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{deal.title}</p>
                        )}
                        <div className="mt-1.5">
                          <div className="flex items-center gap-1 mb-0">
                            <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">Valor da Compra</span>
                          </div>
                          <span className="text-xs font-semibold text-primary">{formatCurrency(deal.value)}</span>
                        </div>
                        <div className="flex items-center justify-end mt-1">
                          {deal.contact_whatsapp && (
                            <a
                              href={`https://wa.me/${deal.contact_whatsapp.replace(/\D/g, "").replace(/^(?!55)/, "55")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md hover:bg-green-500/10 text-green-600 transition-colors"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}

                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
                    Arraste cards aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CRM;
