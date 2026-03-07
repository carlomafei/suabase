import { useEffect, useState, useCallback } from "react";
import { formatCpf } from "@/lib/business-rules";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Loader2, GripVertical, User, Settings2, Check, MessageCircle, ShoppingCart, Search, ChevronRight, ArrowUpDown, ArrowRightLeft, MoveRight, Plus, Palette } from "lucide-react";
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

type PopoverView = "menu" | "configure" | "sort" | "move-stage" | "move-cards";

const StageSettingsPopover = ({
  stage,
  stages,
  onSave,
  onDelete,
  onMoveStage,
  onSortCards,
  onCreateStage,
}: {
  stage: Stage;
  stages: Stage[];
  onSave: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  onMoveStage: (id: string, direction: "left" | "right") => void;
  onSortCards: (stageId: string, order: "asc" | "desc") => void;
  onCreateStage: (afterPosition: number) => void;
}) => {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PopoverView>("menu");

  useEffect(() => { setName(stage.name); setColor(stage.color); }, [stage.name, stage.color]);
  useEffect(() => { if (!open) setView("menu"); }, [open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(stage.id, name.trim(), color);
    setView("menu");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-1 rounded hover:bg-white/20 text-white transition-colors">
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        {view === "menu" && (
          <div className="py-1">
            <button className="w-full flex items-center px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors" onClick={() => setView("sort")}>
              <span className="flex-1 text-left">Ordenar cards da fase</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors" onClick={() => setView("move-cards")}>
              <span className="flex-1 text-left">Configurar mover cards</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors" onClick={() => setView("move-stage")}>
              <span className="flex-1 text-left">Mover fase para</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors" onClick={() => { onCreateStage(stage.position); setOpen(false); }}>
              <span className="flex-1 text-left">Criar uma nova fase</span>
            </button>
            <button className="w-full flex items-center px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors" onClick={() => setView("configure")}>
              <span className="flex-1 text-left">Configurar fase</span>
            </button>
            <Separator />
            <button className="w-full flex items-center px-3 py-2.5 text-sm text-destructive hover:bg-muted transition-colors" onClick={() => { onDelete(stage.id); setOpen(false); }}>
              <span className="flex-1 text-left">Excluir fase</span>
            </button>
          </div>
        )}

        {view === "configure" && (
          <div className="p-3 space-y-3">
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setView("menu")}>← Voltar</button>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título da fase</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cor do cabeçalho</label>
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
            <Button size="sm" className="w-full h-8 text-xs" onClick={handleSave}>Salvar</Button>
          </div>
        )}

        {view === "sort" && (
          <div className="py-1">
            <button className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setView("menu")}>← Voltar</button>
            <button className="w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted text-left" onClick={() => { onSortCards(stage.id, "asc"); setOpen(false); }}>Menor valor primeiro</button>
            <button className="w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted text-left" onClick={() => { onSortCards(stage.id, "desc"); setOpen(false); }}>Maior valor primeiro</button>
          </div>
        )}

        {view === "move-stage" && (
          <div className="py-1">
            <button className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setView("menu")}>← Voltar</button>
            <button className="w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted text-left disabled:opacity-40" disabled={stage.position === 0} onClick={() => { onMoveStage(stage.id, "left"); setOpen(false); }}>← Mover para esquerda</button>
            <button className="w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted text-left disabled:opacity-40" disabled={stage.position === stages.length - 1} onClick={() => { onMoveStage(stage.id, "right"); setOpen(false); }}>→ Mover para direita</button>
          </div>
        )}

        {view === "move-cards" && (
          <div className="py-1">
            <button className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setView("menu")}>← Voltar</button>
            {stages.filter((s) => s.id !== stage.id).map((s) => (
              <button key={s.id} className="w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted text-left flex items-center gap-2" onClick={() => { toast.info(`Mover cards para "${s.name}" — em breve`); setOpen(false); }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.name}
              </button>
            ))}
          </div>
        )}
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
  const [searchTerm, setSearchTerm] = useState("");
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

  const handleDeleteStage = async (stageId: string) => {
    const stageDealsCount = deals.filter((d) => d.stage_id === stageId).length;
    if (stageDealsCount > 0) {
      toast.error("Remova ou mova os cards antes de excluir a fase");
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== stageId));
    const { error } = await supabase.from("crm_stages").delete().eq("id", stageId);
    if (error) { toast.error("Erro ao excluir fase"); fetchData(); }
    else toast.success("Fase excluída");
  };

  const handleMoveStage = async (stageId: string, direction: "left" | "right") => {
    const idx = stages.findIndex((s) => s.id === stageId);
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stages.length) return;
    const updated = [...stages];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    updated[idx].position = idx;
    updated[swapIdx].position = swapIdx;
    setStages(updated);
    await Promise.all([
      supabase.from("crm_stages").update({ position: idx }).eq("id", updated[idx].id),
      supabase.from("crm_stages").update({ position: swapIdx }).eq("id", updated[swapIdx].id),
    ]);
    toast.success("Fase movida");
  };

  const handleSortCards = (stageId: string, order: "asc" | "desc") => {
    setDeals((prev) => {
      const others = prev.filter((d) => d.stage_id !== stageId);
      const stageCards = prev.filter((d) => d.stage_id === stageId)
        .sort((a, b) => order === "asc" ? a.value - b.value : b.value - a.value)
        .map((d, i) => ({ ...d, position: i }));
      return [...others, ...stageCards];
    });
    toast.success("Cards ordenados");
  };

  const handleCreateStage = async (afterPosition: number) => {
    if (!tenantId) return;
    const pipelineRes = await supabase.from("crm_pipelines").select("id").eq("tenant_id", tenantId).limit(1).single();
    if (!pipelineRes.data) { toast.error("Pipeline não encontrado"); return; }
    const newPos = afterPosition + 1;
    // Shift existing stages
    await supabase.from("crm_stages").update({ position: newPos }).gte("position", newPos).eq("tenant_id", tenantId);
    const { error } = await supabase.from("crm_stages").insert({
      name: "Nova fase",
      position: newPos,
      color: "#64748b",
      tenant_id: tenantId,
      pipeline_id: pipelineRes.data.id,
    });
    if (error) toast.error("Erro ao criar fase");
    else { toast.success("Nova fase criada"); fetchData(); }
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
    <div className="flex flex-col h-[calc(100vh-6rem)]">

      {/* Search + Create */}
      <div className="flex items-center gap-3 mb-4 justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-md border-border bg-background"
          />
        </div>
        <Button onClick={() => handleCreateStage(stages.length > 0 ? stages[stages.length - 1].position : -1)} className="h-10 gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Criar nova fase
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {stages.map((stage) => {
          const searchLower = searchTerm.toLowerCase();
          const stageDeals = deals
            .filter((d) => d.stage_id === stage.id)
            .filter((d) => !searchTerm || 
              (d.contact_name?.toLowerCase().includes(searchLower)) ||
              (d.contact_cpf_cnpj?.includes(searchTerm)) ||
              (d.title?.toLowerCase().includes(searchLower))
            )
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
                <StageSettingsPopover stage={stage} stages={stages} onSave={handleStageUpdate} onDelete={handleDeleteStage} onMoveStage={handleMoveStage} onSortCards={handleSortCards} onCreateStage={handleCreateStage} />
              </div>

              {/* Stage total value */}
              <div className="mt-1.5">
                <div
                  className="relative flex items-center justify-center gap-6 px-4 py-1 text-[10px] font-semibold"
                  style={{ backgroundColor: `${stage.color}18` }}
                >
                  <span className="uppercase tracking-wider whitespace-nowrap mr-auto" style={{ color: stage.color }}>Valor da Compra</span>
                  <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none" style={{ color: stage.color }}>|</span>
                  <span className="mr-auto" style={{ color: stage.color }}>
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
                          <p className="text-sm font-medium truncate flex-1">{deal.contact_name || deal.title}</p>
                          {deal.contact_whatsapp && (
                            <a
                              href={`https://wa.me/${deal.contact_whatsapp.replace(/\D/g, "").replace(/^(?!55)/, "55")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-md hover:bg-green-500/10 text-green-600 transition-colors shrink-0"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          )}
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
