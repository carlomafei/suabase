import { useEffect, useState, useCallback, useRef } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, GripVertical, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
        .select("id, title, value, position, stage_id, contact_id, contacts(name, whatsapp)")
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
      }))
    );
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">CRM</h1>
        <p className="text-muted-foreground text-sm mt-1">Pipeline Kanban — arraste os cards entre as colunas</p>
      </div>

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
              <div className="flex items-center gap-2 p-3 border-b border-border/50">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="font-display font-semibold text-sm">{stage.name}</span>
                <Badge variant="secondary" className="text-xs ml-auto">{stageDeals.length}</Badge>
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
                        <p className="text-sm font-medium truncate">{deal.title}</p>
                        {deal.contact_name && (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{deal.contact_name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1.5">
                          <DollarSign className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">{formatCurrency(deal.value)}</span>
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
