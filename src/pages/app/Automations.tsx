import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, Clock, MessageCircle, GitBranch, Send, Pause, Sparkles, ArrowRight,
  Plus, Trash2, Loader2, Play, Square, ChevronDown, ChevronRight, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────
type TriggerType = "new_order" | "stage_change" | "message_received" | "scheduled";
type ActionType = "send_template" | "wait_response" | "classify_ai" | "move_stage";

interface AutomationNode {
  id: string;
  type: "trigger" | "action";
  triggerType?: TriggerType;
  actionType?: ActionType;
  config: Record<string, any>;
}

interface Automation {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  actions: AutomationNode[];
  created_at: string;
}

// ── Configs ────────────────────────────────────────────
const TRIGGERS: { type: TriggerType; label: string; icon: typeof Zap; color: string }[] = [
  { type: "new_order", label: "Novo Pedido", icon: Zap, color: "text-primary" },
  { type: "scheduled", label: "Programação", icon: Clock, color: "text-amber-400" },
  { type: "message_received", label: "Mensagem Recebida", icon: MessageCircle, color: "text-blue-400" },
  { type: "stage_change", label: "Mudança de Etapa", icon: GitBranch, color: "text-purple-400" },
];

const ACTIONS: { type: ActionType; label: string; icon: typeof Send; color: string; category: string }[] = [
  { type: "send_template", label: "Enviar Template WhatsApp", icon: Send, color: "text-primary", category: "Comunicação" },
  { type: "wait_response", label: "Aguardar Resposta", icon: Pause, color: "text-amber-400", category: "Comunicação" },
  { type: "classify_ai", label: "Classificar com IA", icon: Sparkles, color: "text-purple-400", category: "Inteligência Artificial" },
  { type: "move_stage", label: "Mover Etapa CRM", icon: ArrowRight, color: "text-blue-400", category: "Lógica" },
];

const Automations = () => {
  const { tenantId } = useTenant();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType>("new_order");
  const [flowNodes, setFlowNodes] = useState<AutomationNode[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string; variables: string[] | null }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_name: string }[]>([]);

  const fetchAutomations = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    const { data } = await supabase
      .from("automations")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    setAutomations(
      (data || []).map((a: any) => ({
        ...a,
        trigger_config: a.trigger_config || {},
        actions: Array.isArray(a.actions) ? a.actions as AutomationNode[] : [],
      }))
    );
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  // Fetch templates and stages for action configs
  useEffect(() => {
    if (!tenantId) return;
    const fetchMeta = async () => {
      const [tplRes, stgRes] = await Promise.all([
        supabase.from("whatsapp_templates").select("id, name, content, variables").eq("tenant_id", tenantId).eq("is_active", true),
        supabase.from("crm_stages").select("id, name, pipeline_id, crm_pipelines(name)").eq("tenant_id", tenantId).order("position"),
      ]);
      setTemplates((tplRes.data || []).map((t: any) => ({ id: t.id, name: t.name, content: t.content || "", variables: t.variables || null })));
      setStages((stgRes.data || []).map((s: any) => ({ id: s.id, name: s.name, pipeline_name: s.crm_pipelines?.name || "" })));
    };
    fetchMeta();
  }, [tenantId]);

  const openEditor = (auto: Automation) => {
    setEditing(auto);
    setNewName(auto.name);
    setSelectedTrigger(auto.trigger_type as TriggerType);
    setFlowNodes(auto.actions.length > 0 ? auto.actions : []);
  };

  const openCreate = () => {
    setShowCreate(true);
    setNewName("");
    setSelectedTrigger("new_order");
    setFlowNodes([]);
    setEditing(null);
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    setFlowNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n));
  };

  const addAction = (type: ActionType) => {
    const newId = crypto.randomUUID();
    setFlowNodes((prev) => [
      ...prev,
      { id: newId, type: "action", actionType: type, config: {} },
    ]);
    setExpandedNodeId(newId);
  };

  const removeNode = (id: string) => {
    setFlowNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSave = async () => {
    if (!tenantId || !newName.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);

    const payload = {
      name: newName,
      tenant_id: tenantId,
      trigger_type: selectedTrigger,
      trigger_config: {} as any,
      actions: flowNodes as any,
      is_active: editing?.is_active ?? false,
    };

    if (editing) {
      const { error } = await supabase
        .from("automations")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) toast.error("Erro ao salvar"); else toast.success("Automação atualizada!");
    } else {
      const { error } = await supabase.from("automations").insert(payload);
      if (error) toast.error("Erro ao criar"); else toast.success("Automação criada!");
    }

    setSaving(false);
    setShowCreate(false);
    setEditing(null);
    fetchAutomations();
  };

  const toggleActive = async (auto: Automation) => {
    await supabase
      .from("automations")
      .update({ is_active: !auto.is_active, updated_at: new Date().toISOString() })
      .eq("id", auto.id);
    fetchAutomations();
  };

  const deleteAutomation = async (id: string) => {
    await supabase.from("automations").delete().eq("id", id);
    toast.success("Automação removida");
    fetchAutomations();
  };

  const isEditorOpen = showCreate || !!editing;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Editor View ──
  if (isEditorOpen) {
    const triggerInfo = TRIGGERS.find((t) => t.type === selectedTrigger);
    const TriggerIcon = triggerInfo?.icon || Zap;

    return (
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
        {/* Left sidebar */}
        <div className="w-full lg:w-64 shrink-0 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da automação"
              className="font-display font-semibold text-sm h-9"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 text-xs flex-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditing(null); }} className="text-xs">
              Voltar
            </Button>
          </div>

          {/* Triggers */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Gatilhos</p>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGERS.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setSelectedTrigger(t.type)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors",
                    selectedTrigger === t.type
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <t.icon className={cn("h-5 w-5", t.color)} />
                  <span className="text-center leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions grouped by category */}
          {["Comunicação", "Inteligência Artificial", "Lógica"].map((cat) => {
            const catActions = ACTIONS.filter((a) => a.category === cat);
            if (catActions.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-2 gap-2">
                  {catActions.map((a) => (
                    <button
                      key={a.type}
                      onClick={() => addAction(a.type)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                    >
                      <a.icon className={cn("h-5 w-5", a.color)} />
                      <span className="text-center leading-tight">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1 rounded-xl border border-border/50 bg-card/30 overflow-y-auto p-6">
          <div className="flex flex-col items-center gap-4 min-h-full">
            {/* Trigger node */}
            <Card className={cn("w-72 border-2 border-primary/40 bg-primary/5")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <TriggerIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">{triggerInfo?.label}</p>
                  <p className="text-xs text-muted-foreground">Gatilho inicial</p>
                </div>
              </CardContent>
            </Card>

            {/* Flow connector */}
            {flowNodes.length > 0 && (
              <div className="w-px h-6 bg-border" />
            )}

            {/* Action nodes */}
            {flowNodes.map((node, i) => {
              const actionInfo = ACTIONS.find((a) => a.type === node.actionType);
              const ActionIcon = actionInfo?.icon || Zap;
              const isExpanded = expandedNodeId === node.id;
              const borderColor = node.actionType === "classify_ai" ? "border-purple-400/40" :
                                  node.actionType === "wait_response" ? "border-amber-400/40" :
                                  node.actionType === "send_template" ? "border-primary/40" : "border-blue-400/40";
              const bgColor = node.actionType === "classify_ai" ? "bg-purple-400/5" :
                              node.actionType === "wait_response" ? "bg-amber-400/5" :
                              node.actionType === "send_template" ? "bg-primary/5" : "bg-blue-400/5";

              return (
                <div key={node.id} className="flex flex-col items-center gap-4">
                  <Card className={cn("w-80 border-2 relative group", borderColor, bgColor)}>
                    <CardContent className="p-0">
                      <button
                        onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                        className="w-full p-4 flex items-center gap-3 text-left"
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          node.actionType === "classify_ai" ? "bg-purple-400/15" :
                          node.actionType === "wait_response" ? "bg-amber-400/15" :
                          node.actionType === "send_template" ? "bg-primary/15" : "bg-blue-400/15"
                        )}>
                          <ActionIcon className={cn("h-5 w-5", actionInfo?.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-sm">{actionInfo?.label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {node.actionType === "send_template" && node.config.template_name ? node.config.template_name :
                             node.actionType === "wait_response" ? `Timeout: ${node.config.timeout || "1"}${node.config.timeout_unit === "min" ? " min" : "h"}` :
                             node.actionType === "classify_ai" ? (node.config.labels || "Positivo, Neutro, Negativo") :
                             node.actionType === "move_stage" && node.config.stage_name ? node.config.stage_name :
                             "Clique para configurar"}
                          </p>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </button>

                      {/* Config panel */}
                      {isExpanded && (
                        <div className="border-t border-border/50 p-4 space-y-3">
                          {node.actionType === "send_template" && (() => {
                            const selectedTpl = templates.find((t) => t.id === node.config.template_id);
                            return (
                              <>
                                <div>
                                  <Label className="text-xs">Template WhatsApp</Label>
                                  <Select
                                    value={node.config.template_id || ""}
                                    onValueChange={(v) => {
                                      const tpl = templates.find((t) => t.id === v);
                                      updateNodeConfig(node.id, {
                                        template_id: v,
                                        template_name: tpl?.name || "",
                                        custom_message: tpl?.content || "",
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs mt-1">
                                      <SelectValue placeholder="Selecionar template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {templates.length === 0 && (
                                        <SelectItem value="_none" disabled>Nenhum template cadastrado</SelectItem>
                                      )}
                                      {templates.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {selectedTpl && selectedTpl.variables && selectedTpl.variables.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="text-xs text-muted-foreground">Variáveis:</span>
                                    {selectedTpl.variables.map((v) => (
                                      <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                                        {"{{" + v + "}}"}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <div>
                                  <Label className="text-xs">Mensagem personalizada</Label>
                                  <Textarea
                                    value={node.config.custom_message || ""}
                                    onChange={(e) => updateNodeConfig(node.id, { custom_message: e.target.value })}
                                    placeholder={selectedTpl ? selectedTpl.content : "Selecione um template acima..."}
                                    className="text-xs mt-1 min-h-[120px] font-mono leading-relaxed"
                                  />
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    Edite a mensagem acima para personalizar. As variáveis serão substituídas automaticamente.
                                  </p>
                                </div>
                              </>
                            );
                          })()}

                          {node.actionType === "wait_response" && (
                            <>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs">Tempo de espera</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={node.config.timeout || "1"}
                                    onChange={(e) => updateNodeConfig(node.id, { timeout: e.target.value })}
                                    className="h-8 text-xs mt-1"
                                  />
                                </div>
                                <div className="w-24">
                                  <Label className="text-xs">Unidade</Label>
                                  <Select
                                    value={node.config.timeout_unit || "hour"}
                                    onValueChange={(v) => updateNodeConfig(node.id, { timeout_unit: v })}
                                  >
                                    <SelectTrigger className="h-8 text-xs mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="min">Minutos</SelectItem>
                                      <SelectItem value="hour">Horas</SelectItem>
                                      <SelectItem value="day">Dias</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Ação se expirar</Label>
                                <Select
                                  value={node.config.on_timeout || "skip"}
                                  onValueChange={(v) => updateNodeConfig(node.id, { on_timeout: v })}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="skip">Pular para próxima ação</SelectItem>
                                    <SelectItem value="stop">Parar automação</SelectItem>
                                    <SelectItem value="retry">Reenviar mensagem</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {node.actionType === "classify_ai" && (
                            <>
                              <div>
                                <Label className="text-xs">Rótulos de classificação</Label>
                                <Input
                                  value={node.config.labels || "Positivo, Neutro, Negativo"}
                                  onChange={(e) => updateNodeConfig(node.id, { labels: e.target.value })}
                                  placeholder="Positivo, Neutro, Negativo"
                                  className="h-8 text-xs mt-1"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Separe os rótulos por vírgula</p>
                              </div>
                              <div>
                                <Label className="text-xs">Prompt de contexto (opcional)</Label>
                                <Textarea
                                  value={node.config.ai_prompt || ""}
                                  onChange={(e) => updateNodeConfig(node.id, { ai_prompt: e.target.value })}
                                  placeholder="Ex: Classifique o sentimento da mensagem do cliente..."
                                  className="text-xs mt-1 min-h-[60px]"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Modelo IA</Label>
                                <Select
                                  value={node.config.ai_model || "gemini-flash"}
                                  onValueChange={(v) => updateNodeConfig(node.id, { ai_model: v })}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gemini-flash">Gemini Flash (rápido)</SelectItem>
                                    <SelectItem value="gemini-pro">Gemini Pro (preciso)</SelectItem>
                                    <SelectItem value="gpt-mini">GPT Mini (equilibrado)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          {node.actionType === "move_stage" && (
                            <>
                              <div>
                                <Label className="text-xs">Etapa de destino</Label>
                                <Select
                                  value={node.config.stage_id || ""}
                                  onValueChange={(v) => {
                                    const stg = stages.find((s) => s.id === v);
                                    updateNodeConfig(node.id, { stage_id: v, stage_name: stg ? `${stg.pipeline_name} → ${stg.name}` : "" });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs mt-1">
                                    <SelectValue placeholder="Selecionar etapa" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stages.length === 0 && (
                                      <SelectItem value="_none" disabled>Nenhuma etapa cadastrada</SelectItem>
                                    )}
                                    {stages.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.pipeline_name} → {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Observação (opcional)</Label>
                                <Input
                                  value={node.config.note || ""}
                                  onChange={(e) => updateNodeConfig(node.id, { note: e.target.value })}
                                  placeholder="Motivo da movimentação..."
                                  className="h-8 text-xs mt-1"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Classify AI branches */}
                      {node.actionType === "classify_ai" && !isExpanded && (
                        <div className="px-4 pb-3 flex gap-2 justify-center">
                          {(node.config.labels || "Positivo, Neutro, Negativo").split(",").slice(0, 4).map((label: string, li: number) => (
                            <Badge key={li} className={cn("text-xs",
                              li === 0 ? "bg-primary/15 text-primary" :
                              li === 1 ? "bg-amber-400/15 text-amber-400" :
                              "bg-destructive/15 text-destructive"
                            )}>
                              {label.trim().substring(0, 6)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {i < flowNodes.length - 1 && <div className="w-px h-6 bg-border" />}
                </div>
              );
            })}

            {/* Add action hint */}
            <button
              onClick={() => addAction("send_template")}
              className="w-72 border-2 border-dashed border-border/50 rounded-xl p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors mt-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar etapa
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Automações</h1>
          <p className="text-muted-foreground text-sm mt-1">Regras automáticas de engajamento</p>
        </div>
        <Button onClick={openCreate} className="gap-2 text-xs">
          <Plus className="h-4 w-4" />
          Nova automação
        </Button>
      </div>

      {automations.length === 0 ? (
        <Card className="border-border/50 p-8 text-center">
          <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma automação criada ainda.</p>
          <Button variant="outline" className="mt-4 text-xs gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Criar automação
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {automations.map((auto) => {
            const triggerInfo = TRIGGERS.find((t) => t.type === auto.trigger_type);
            const TriggerIcon = triggerInfo?.icon || Zap;
            return (
              <Card key={auto.id} className={cn("border-border/50 transition-colors", auto.is_active && "border-primary/20")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-display truncate">{auto.name}</CardTitle>
                    <Switch checked={auto.is_active} onCheckedChange={() => toggleActive(auto)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <TriggerIcon className={cn("h-4 w-4", triggerInfo?.color)} />
                    <span className="text-xs text-muted-foreground">{triggerInfo?.label || auto.trigger_type}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{auto.actions.length} ação(ões)</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => openEditor(auto)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => deleteAutomation(auto.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Automations;
