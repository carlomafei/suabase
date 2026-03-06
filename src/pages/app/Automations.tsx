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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Zap, Clock, MessageCircle, GitBranch, Send, Pause, Sparkles, ArrowRight,
  Plus, Trash2, Loader2, Play, Square, ChevronDown, ChevronRight, Settings2, X,
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

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const MARKETPLACES = ["Shopee", "Mercado Livre", "Amazon", "Magalu", "Americanas"];

const parseLabels = (labels: string): string[] =>
  labels.split(",").map((l) => l.trim()).filter(Boolean);

const BRANCH_COLORS = [
  { badge: "bg-primary/15 text-primary", border: "border-primary/40", bg: "bg-primary/5", connector: "bg-primary/40" },
  { badge: "bg-destructive/15 text-destructive", border: "border-destructive/40", bg: "bg-destructive/5", connector: "bg-destructive/40" },
  { badge: "bg-amber-400/15 text-amber-400", border: "border-amber-400/40", bg: "bg-amber-400/5", connector: "bg-amber-400/40" },
  { badge: "bg-blue-400/15 text-blue-400", border: "border-blue-400/40", bg: "bg-blue-400/5", connector: "bg-blue-400/40" },
];

const syncBranches = (
  currentBranches: Record<string, AutomationNode[]> | undefined,
  labels: string[]
): Record<string, AutomationNode[]> => {
  const branches: Record<string, AutomationNode[]> = {};
  for (const label of labels) {
    branches[label] = currentBranches?.[label] || [];
  }
  return branches;
};

// ── Trigger Config Panel for new_order ──
const NewOrderTriggerConfigPanel = ({
  config,
  onClose,
  onUpdateConfig,
}: {
  config: Record<string, any>;
  onClose: () => void;
  onUpdateConfig: (config: Record<string, any>) => void;
}) => {
  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm">Configurar Gatilho: Cliente Capturado</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* CPF ou CNPJ */}
          <div>
            <Label className="text-xs font-semibold">Tipo de Documento</Label>
            <Select
              value={config.doc_type || "all"}
              onValueChange={(v) => onUpdateConfig({ doc_type: v })}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (CPF e CNPJ)</SelectItem>
                <SelectItem value="cpf">Somente CPF (Pessoa Física)</SelectItem>
                <SelectItem value="cnpj">Somente CNPJ (Pessoa Jurídica)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Filtre pedidos por tipo de documento do cliente</p>
          </div>

          {/* Valor da Venda */}
          <div>
            <Label className="text-xs font-semibold">Valor da Venda</Label>
            <div className="flex gap-2 mt-1">
              <Select
                value={config.value_operator || "gte"}
                onValueChange={(v) => onUpdateConfig({ value_operator: v })}
              >
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gte">Maior que</SelectItem>
                  <SelectItem value="lte">Menor que</SelectItem>
                  <SelectItem value="eq">Igual a</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={config.value_amount || ""}
                onChange={(e) => onUpdateConfig({ value_amount: e.target.value })}
                placeholder="Ex: 100.00"
                className="h-8 text-xs flex-1"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Deixe o valor em branco para aceitar qualquer valor</p>
          </div>

          {/* Produto (incluir) */}
          <div>
            <Label className="text-xs font-semibold">Produto (incluir)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={config.product_include || ""}
                onChange={(e) => onUpdateConfig({ product_include: e.target.value })}
                placeholder="Nome do produto"
                className="h-8 text-xs flex-1"
              />
              <Select
                value={config.product_include_op || "contains"}
                onValueChange={(v) => onUpdateConfig({ product_include_op: v })}
              >
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="not_contains">NÃO contém</SelectItem>
                  <SelectItem value="equals">Igual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Produto (excluir) */}
          <div>
            <Label className="text-xs font-semibold">Produto (excluir)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={config.product_exclude || ""}
                onChange={(e) => onUpdateConfig({ product_exclude: e.target.value })}
                placeholder="Produto a excluir"
                className="h-8 text-xs flex-1"
              />
              <Select
                value={config.product_exclude_op || "not_contains"}
                onValueChange={(v) => onUpdateConfig({ product_exclude_op: v })}
              >
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="not_contains">NÃO contém</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Pedidos com este produto serão ignorados</p>
          </div>

          {/* Estado (incluir) */}
          <div>
            <Label className="text-xs font-semibold">Estado (incluir)</Label>
            <Select
              value={config.state_include || "all"}
              onValueChange={(v) => onUpdateConfig({ state_include: v })}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Todos os estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {BRAZILIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado (excluir) */}
          <div>
            <Label className="text-xs font-semibold">Estado (excluir)</Label>
            <Select
              value={config.state_exclude || "none"}
              onValueChange={(v) => onUpdateConfig({ state_exclude: v })}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue placeholder="Nenhum estado excluído" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum estado excluído</SelectItem>
                {BRAZILIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Pedidos deste estado serão ignorados</p>
          </div>

          {/* Cidade (incluir) */}
          <div>
            <Label className="text-xs font-semibold">Cidade (incluir)</Label>
            <Input
              value={config.city_include || ""}
              onChange={(e) => onUpdateConfig({ city_include: e.target.value })}
              placeholder="Ex: São Paulo"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Cidade (excluir) */}
          <div>
            <Label className="text-xs font-semibold">Cidade (excluir)</Label>
            <Input
              value={config.city_exclude || ""}
              onChange={(e) => onUpdateConfig({ city_exclude: e.target.value })}
              placeholder="Cidade a excluir"
              className="h-8 text-xs mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Pedidos desta cidade serão ignorados</p>
          </div>

          <Separator />

          {/* Marketplaces (incluir) */}
          <div>
            <Label className="text-xs font-semibold">Marketplaces (incluir)</Label>
            <RadioGroup
              value={config.marketplace_include || ""}
              onValueChange={(v) => onUpdateConfig({ marketplace_include: v })}
              className="mt-2 space-y-1.5"
            >
              {MARKETPLACES.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <RadioGroupItem value={m} id={`mp-inc-${m}`} />
                  <Label htmlFor={`mp-inc-${m}`} className="text-xs font-normal cursor-pointer">{m}</Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="outro" id="mp-inc-outro" />
                <Label htmlFor="mp-inc-outro" className="text-xs font-normal cursor-pointer">Outro</Label>
              </div>
            </RadioGroup>
            <p className="text-[10px] text-muted-foreground mt-1.5">Deixe vazio para aceitar todos os marketplaces</p>
            {config.marketplace_include && (
              <button
                onClick={() => onUpdateConfig({ marketplace_include: "" })}
                className="text-[10px] text-primary underline mt-0.5"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <Separator />

          {/* Marketplaces (excluir) */}
          <div>
            <Label className="text-xs font-semibold">Marketplaces (excluir)</Label>
            <RadioGroup
              value={config.marketplace_exclude || ""}
              onValueChange={(v) => onUpdateConfig({ marketplace_exclude: v })}
              className="mt-2 space-y-1.5"
            >
              {MARKETPLACES.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <RadioGroupItem value={`NOT_${m}`} id={`mp-exc-${m}`} />
                  <Label htmlFor={`mp-exc-${m}`} className="text-xs font-normal cursor-pointer">NÃO {m}</Label>
                </div>
              ))}
            </RadioGroup>
            {config.marketplace_exclude && (
              <button
                onClick={() => onUpdateConfig({ marketplace_exclude: "" })}
                className="text-[10px] text-primary underline mt-1"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

// ── Trigger Config Panel for scheduled ──
const WEEKDAYS = [
  { value: "mon", label: "Seg" },
  { value: "tue", label: "Ter" },
  { value: "wed", label: "Qua" },
  { value: "thu", label: "Qui" },
  { value: "fri", label: "Sex" },
  { value: "sat", label: "Sáb" },
  { value: "sun", label: "Dom" },
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
];

const ScheduledTriggerConfigPanel = ({
  config,
  onClose,
  onUpdateConfig,
}: {
  config: Record<string, any>;
  onClose: () => void;
  onUpdateConfig: (config: Record<string, any>) => void;
}) => {
  const recurrence = config.recurrence || "daily";
  const toggleWeekday = (day: string) => {
    const current: string[] = config.weekdays || [];
    const updated = current.includes(day) ? current.filter((d: string) => d !== day) : [...current, day];
    onUpdateConfig({ weekdays: updated });
  };

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm">Configurar Gatilho: Programação</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Recorrência */}
          <div>
            <Label className="text-xs font-semibold">Tipo de recorrência</Label>
            <Select
              value={recurrence}
              onValueChange={(v) => onUpdateConfig({ recurrence: v })}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Única vez</SelectItem>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="custom">Personalizado (Cron)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Horário */}
          {recurrence !== "custom" && (
            <div>
              <Label className="text-xs font-semibold">Horário de execução</Label>
              <Input
                type="time"
                value={config.time || "09:00"}
                onChange={(e) => onUpdateConfig({ time: e.target.value })}
                className="h-8 text-xs mt-1"
              />
            </div>
          )}

          {/* Data específica (única vez) */}
          {recurrence === "once" && (
            <div>
              <Label className="text-xs font-semibold">Data de execução</Label>
              <Input
                type="date"
                value={config.run_date || ""}
                onChange={(e) => onUpdateConfig({ run_date: e.target.value })}
                className="h-8 text-xs mt-1"
              />
            </div>
          )}

          {/* Dias da semana (semanal) */}
          {recurrence === "weekly" && (
            <div>
              <Label className="text-xs font-semibold">Dias da semana</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {WEEKDAYS.map((day) => {
                  const active = (config.weekdays || []).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleWeekday(day.value)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Selecione os dias em que a automação será executada</p>
            </div>
          )}

          {/* Dia do mês (mensal) */}
          {recurrence === "monthly" && (
            <div>
              <Label className="text-xs font-semibold">Dia do mês</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={config.month_day || 1}
                onChange={(e) => onUpdateConfig({ month_day: parseInt(e.target.value) || 1 })}
                className="h-8 text-xs mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">De 1 a 31. Se o mês não tiver o dia, executa no último dia.</p>
            </div>
          )}

          {/* Cron (personalizado) */}
          {recurrence === "custom" && (
            <div>
              <Label className="text-xs font-semibold">Expressão Cron</Label>
              <Input
                value={config.cron_expression || ""}
                onChange={(e) => onUpdateConfig({ cron_expression: e.target.value })}
                placeholder="0 9 * * 1-5"
                className="h-8 text-xs mt-1 font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Formato: minuto hora dia mês dia_semana<br />
                Ex: <span className="font-mono">0 9 * * 1-5</span> = Seg-Sex às 9h
              </p>
            </div>
          )}

          <Separator />

          {/* Fuso horário */}
          <div>
            <Label className="text-xs font-semibold">Fuso horário</Label>
            <Select
              value={config.timezone || "America/Sao_Paulo"}
              onValueChange={(v) => onUpdateConfig({ timezone: v })}
            >
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

// ── Side Panel Config Component ──
const NodeConfigPanel = ({
  node,
  title,
  onClose,
  onUpdateConfig,
  templates,
  stages,
}: {
  node: AutomationNode;
  title: string;
  onClose: () => void;
  onUpdateConfig: (config: Record<string, any>) => void;
  templates: { id: string; name: string; content: string; variables: string[] | null }[];
  stages: { id: string; name: string; pipeline_name: string }[];
}) => {
  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display font-semibold text-sm truncate">Configurar: {title}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
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
                      onUpdateConfig({
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
                    onChange={(e) => onUpdateConfig({ custom_message: e.target.value })}
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
                    onChange={(e) => onUpdateConfig({ timeout: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Unidade</Label>
                  <Select
                    value={node.config.timeout_unit || "hour"}
                    onValueChange={(v) => onUpdateConfig({ timeout_unit: v })}
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
                  onValueChange={(v) => onUpdateConfig({ on_timeout: v })}
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
                  onChange={(e) => onUpdateConfig({ labels: e.target.value })}
                  placeholder="Positivo, Neutro, Negativo"
                  className="h-8 text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Separe os rótulos por vírgula.</p>
              </div>
              <div>
                <Label className="text-xs">Prompt de contexto (opcional)</Label>
                <Textarea
                  value={node.config.ai_prompt || ""}
                  onChange={(e) => onUpdateConfig({ ai_prompt: e.target.value })}
                  placeholder="Ex: Classifique o sentimento da mensagem do cliente..."
                  className="text-xs mt-1 min-h-[60px]"
                />
              </div>
              <div>
                <Label className="text-xs">Modelo IA</Label>
                <Select
                  value={node.config.ai_model || "gemini-flash"}
                  onValueChange={(v) => onUpdateConfig({ ai_model: v })}
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
                    onUpdateConfig({ stage_id: v, stage_name: stg ? `${stg.pipeline_name} → ${stg.name}` : "" });
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
                  onChange={(e) => onUpdateConfig({ note: e.target.value })}
                  placeholder="Motivo da movimentação..."
                  className="h-8 text-xs mt-1"
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// ── Branch action config for side panel ──
const BranchNodeConfigPanel = ({
  parentNode,
  label,
  actionIndex,
  branchNode,
  onClose,
  onUpdateConfig,
  onRemove,
  templates,
  stages,
}: {
  parentNode: AutomationNode;
  label: string;
  actionIndex: number;
  branchNode: AutomationNode;
  onClose: () => void;
  onUpdateConfig: (config: Record<string, any>) => void;
  onRemove: () => void;
  templates: { id: string; name: string; content: string; variables: string[] | null }[];
  stages: { id: string; name: string; pipeline_name: string }[];
}) => {
  const actionInfo = ACTIONS.find((a) => a.type === branchNode.actionType);

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-sm truncate">{actionInfo?.label}</h3>
          <p className="text-[10px] text-muted-foreground">Branch: {label}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRemove} className="p-1 rounded hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {branchNode.actionType === "send_template" && (() => {
            const selectedTpl = templates.find((t) => t.id === branchNode.config.template_id);
            return (
              <>
                <div>
                  <Label className="text-xs">Template WhatsApp</Label>
                  <Select
                    value={branchNode.config.template_id || ""}
                    onValueChange={(v) => {
                      const tpl = templates.find((t) => t.id === v);
                      onUpdateConfig({
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
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mensagem personalizada</Label>
                  <Textarea
                    value={branchNode.config.custom_message || ""}
                    onChange={(e) => onUpdateConfig({ custom_message: e.target.value })}
                    placeholder={selectedTpl ? selectedTpl.content : "Selecione um template..."}
                    className="text-xs mt-1 min-h-[100px] font-mono leading-relaxed"
                  />
                </div>
              </>
            );
          })()}

          {branchNode.actionType === "wait_response" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Tempo</Label>
                <Input
                  type="number" min={1}
                  value={branchNode.config.timeout || "1"}
                  onChange={(e) => onUpdateConfig({ timeout: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={branchNode.config.timeout_unit || "hour"}
                  onValueChange={(v) => onUpdateConfig({ timeout_unit: v })}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="min">Min</SelectItem>
                    <SelectItem value="hour">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {branchNode.actionType === "move_stage" && (
            <div>
              <Label className="text-xs">Etapa de destino</Label>
              <Select
                value={branchNode.config.stage_id || ""}
                onValueChange={(v) => {
                  const stg = stages.find((s) => s.id === v);
                  onUpdateConfig({ stage_id: v, stage_name: stg ? `${stg.pipeline_name} → ${stg.name}` : "" });
                }}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue placeholder="Selecionar etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.pipeline_name} → {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

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
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string; variables: string[] | null }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_name: string }[]>([]);
  const [branchActionMenu, setBranchActionMenu] = useState<{ nodeId: string; label: string } | null>(null);

  // Side panel state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedBranchAction, setSelectedBranchAction] = useState<{
    nodeId: string;
    label: string;
    actionIndex: number;
  } | null>(null);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);

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

  const closeSidePanel = () => {
    setSelectedNodeId(null);
    setSelectedBranchAction(null);
    setShowTriggerConfig(false);
  };

  const openEditor = (auto: Automation) => {
    setEditing(auto);
    setNewName(auto.name);
    setSelectedTrigger(auto.trigger_type as TriggerType);
    setFlowNodes(auto.actions.length > 0 ? auto.actions : []);
    setTriggerConfig(auto.trigger_config || {});
    closeSidePanel();
  };

  const openCreate = () => {
    setShowCreate(true);
    setNewName("");
    setSelectedTrigger("new_order");
    setFlowNodes([]);
    setTriggerConfig({});
    setEditing(null);
    closeSidePanel();
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    setFlowNodes((prev) => prev.map((n) => {
      if (n.id !== nodeId) return n;
      const newConfig = { ...n.config, ...config };
      if (n.actionType === "classify_ai" && "labels" in config) {
        const labels = parseLabels(config.labels || "Positivo, Negativo, Neutro");
        newConfig.branches = syncBranches(n.config.branches, labels);
      }
      return { ...n, config: newConfig };
    }));
  };

  const addAction = (type: ActionType) => {
    const newId = crypto.randomUUID();
    const config: Record<string, any> = {};
    if (type === "classify_ai") {
      const defaultLabels = "Positivo, Negativo, Neutro";
      config.labels = defaultLabels;
      config.branches = syncBranches(undefined, parseLabels(defaultLabels));
    }
    setFlowNodes((prev) => [
      ...prev,
      { id: newId, type: "action", actionType: type, config },
    ]);
    setSelectedNodeId(newId);
    setSelectedBranchAction(null);
  };

  const removeNode = (id: string) => {
    setFlowNodes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNodeId === id) closeSidePanel();
  };

  // ── Branch management ──
  const addBranchAction = (nodeId: string, label: string, actionType: ActionType) => {
    const newActionId = crypto.randomUUID();
    setFlowNodes((prev) => prev.map((n) => {
      if (n.id !== nodeId) return n;
      const branches = { ...(n.config.branches || {}) };
      const branchActions = [...(branches[label] || [])];
      branchActions.push({
        id: newActionId,
        type: "action" as const,
        actionType,
        config: {},
      });
      branches[label] = branchActions;
      return { ...n, config: { ...n.config, branches } };
    }));
    setBranchActionMenu(null);
    // Open the new branch action in side panel
    setSelectedNodeId(null);
    setSelectedBranchAction({ nodeId, label, actionIndex: flowNodes.find(n => n.id === nodeId)?.config.branches?.[label]?.length || 0 });
  };

  const removeBranchAction = (nodeId: string, label: string, actionIndex: number) => {
    setFlowNodes((prev) => prev.map((n) => {
      if (n.id !== nodeId) return n;
      const branches = { ...(n.config.branches || {}) };
      const branchActions = [...(branches[label] || [])];
      branchActions.splice(actionIndex, 1);
      branches[label] = branchActions;
      return { ...n, config: { ...n.config, branches } };
    }));
    if (selectedBranchAction?.nodeId === nodeId && selectedBranchAction?.label === label && selectedBranchAction?.actionIndex === actionIndex) {
      closeSidePanel();
    }
  };

  const updateBranchNodeConfig = (nodeId: string, label: string, actionIndex: number, config: Record<string, any>) => {
    setFlowNodes((prev) => prev.map((n) => {
      if (n.id !== nodeId) return n;
      const branches = { ...(n.config.branches || {}) };
      const branchActions = [...(branches[label] || [])];
      if (branchActions[actionIndex]) {
        branchActions[actionIndex] = {
          ...branchActions[actionIndex],
          config: { ...branchActions[actionIndex].config, ...config },
        };
      }
      branches[label] = branchActions;
      return { ...n, config: { ...n.config, branches } };
    }));
  };

  const handleSave = async () => {
    if (!tenantId || !newName.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = {
      name: newName,
      tenant_id: tenantId,
      trigger_type: selectedTrigger,
      trigger_config: triggerConfig as any,
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

  // ── Branches visual renderer ──
  const renderBranches = (node: AutomationNode) => {
    const labels = parseLabels(node.config.labels || "Positivo, Negativo, Neutro");
    const branches: Record<string, AutomationNode[]> = node.config.branches || {};
    if (labels.length === 0) return null;

    return (
      <div className="flex flex-col items-center gap-0 w-full">
        <div className="w-px h-4 bg-border" />
        <div className="relative w-full flex justify-center">
          <div className="flex gap-6 relative">
            {labels.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: `calc(${100 / (labels.length * 2)}% + 0px)`,
                  right: `calc(${100 / (labels.length * 2)}% + 0px)`,
                }}
              />
            )}

            {labels.map((label, li) => {
              const colorSet = BRANCH_COLORS[li % BRANCH_COLORS.length];
              const branchActions = branches[label] || [];

              return (
                <div key={label} className="flex flex-col items-center gap-2 min-w-[140px] max-w-[180px]">
                  <div className={cn("w-px h-4", colorSet.connector)} />
                  <Badge className={cn("text-xs font-semibold", colorSet.badge)}>
                    {label}
                  </Badge>

                  {branchActions.map((branchNode, ai) => {
                    const actionInfo = ACTIONS.find((a) => a.type === branchNode.actionType);
                    const ActionIcon = actionInfo?.icon || Zap;
                    const isSelected = selectedBranchAction?.nodeId === node.id &&
                      selectedBranchAction?.label === label &&
                      selectedBranchAction?.actionIndex === ai;

                    return (
                      <div key={branchNode.id} className="flex flex-col items-center gap-2 w-full">
                        <div className={cn("w-px h-3", colorSet.connector)} />
                        <Card
                          className={cn(
                            "w-full border relative group cursor-pointer transition-all",
                            colorSet.border, colorSet.bg,
                            isSelected && "ring-2 ring-primary"
                          )}
                          onClick={() => {
                            setSelectedNodeId(null);
                            setSelectedBranchAction({ nodeId: node.id, label, actionIndex: ai });
                          }}
                        >
                          <CardContent className="p-2.5 flex items-center gap-2">
                            <ActionIcon className={cn("h-3.5 w-3.5 shrink-0", actionInfo?.color)} />
                            <span className="text-[11px] font-semibold truncate flex-1">{actionInfo?.label}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeBranchAction(node.id, label, ai); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-destructive hover:bg-destructive/10 rounded transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}

                  {/* Add action button */}
                  <div className={cn("w-px h-3", colorSet.connector)} />
                  <div className="relative">
                    <button
                      onClick={() => setBranchActionMenu(
                        branchActionMenu?.nodeId === node.id && branchActionMenu?.label === label
                          ? null
                          : { nodeId: node.id, label }
                      )}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
                        colorSet.border
                      )}
                    >
                      <Plus className="h-3 w-3" />
                    </button>

                    {branchActionMenu?.nodeId === node.id && branchActionMenu?.label === label && (
                      <div className="absolute top-9 left-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-lg shadow-lg p-1.5 min-w-[150px]">
                        {ACTIONS.filter((a) => a.type !== "classify_ai").map((a) => (
                          <button
                            key={a.type}
                            onClick={() => addBranchAction(node.id, label, a.type)}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] rounded hover:bg-muted/50 text-left"
                          >
                            <a.icon className={cn("h-3.5 w-3.5", a.color)} />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Get selected node for side panel
  const selectedNode = selectedNodeId ? flowNodes.find((n) => n.id === selectedNodeId) : null;
  const selectedBranchNode = selectedBranchAction
    ? flowNodes.find((n) => n.id === selectedBranchAction.nodeId)?.config.branches?.[selectedBranchAction.label]?.[selectedBranchAction.actionIndex]
    : null;
  const selectedBranchParentNode = selectedBranchAction
    ? flowNodes.find((n) => n.id === selectedBranchAction.nodeId)
    : null;

  // ── Editor View ──
  if (isEditorOpen) {
    const triggerInfo = TRIGGERS.find((t) => t.type === selectedTrigger);
    const TriggerIcon = triggerInfo?.icon || Zap;

    return (
      <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-3rem)] -m-4 md:-m-6 lg:-m-8">
        {/* Left sidebar - palette */}
        <div className="w-full lg:w-56 shrink-0 space-y-4 overflow-y-auto p-4 border-r border-border">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da automação"
            className="font-display font-semibold text-sm h-9"
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 text-xs flex-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditing(null); closeSidePanel(); }} className="text-xs">
              Voltar
            </Button>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Gatilhos</p>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGERS.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setSelectedTrigger(t.type)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-colors",
                    selectedTrigger === t.type
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <t.icon className={cn("h-4 w-4", t.color)} />
                  <span className="text-center leading-tight text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

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
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border border-border/50 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                    >
                      <a.icon className={cn("h-4 w-4", a.color)} />
                      <span className="text-center leading-tight text-[10px]">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvas - center */}
        <div className="flex-1 overflow-y-auto p-6 bg-card/30" onClick={() => { setBranchActionMenu(null); }}>
          <div className="flex flex-col items-center gap-4 min-h-full">
            {/* Trigger node */}
            <Card
              className={cn(
                "w-64 border-2 border-primary/40 bg-primary/5 cursor-pointer transition-all",
                showTriggerConfig && "ring-2 ring-primary"
              )}
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedBranchAction(null);
                setShowTriggerConfig(!showTriggerConfig);
              }}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <TriggerIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm">{triggerInfo?.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {Object.keys(triggerConfig).length > 0 ? "Configurado" : "Clique para configurar"}
                  </p>
                </div>
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              </CardContent>
            </Card>

            {flowNodes.length > 0 && <div className="w-px h-6 bg-border" />}

            {/* Action nodes */}
            {flowNodes.map((node, i) => {
              const actionInfo = ACTIONS.find((a) => a.type === node.actionType);
              const ActionIcon = actionInfo?.icon || Zap;
              const isSelected = selectedNodeId === node.id;
              const borderColor = node.actionType === "classify_ai" ? "border-purple-400/40" :
                                  node.actionType === "wait_response" ? "border-amber-400/40" :
                                  node.actionType === "send_template" ? "border-primary/40" : "border-blue-400/40";
              const bgColor = node.actionType === "classify_ai" ? "bg-purple-400/5" :
                              node.actionType === "wait_response" ? "bg-amber-400/5" :
                              node.actionType === "send_template" ? "bg-primary/5" : "bg-blue-400/5";

              return (
                <div key={node.id} className="flex flex-col items-center gap-4 w-full">
                  <Card
                    className={cn(
                      "w-64 border-2 relative group mx-auto cursor-pointer transition-all",
                      borderColor, bgColor,
                      isSelected && "ring-2 ring-primary"
                    )}
                    onClick={() => {
                      setSelectedBranchAction(null);
                      setSelectedNodeId(isSelected ? null : node.id);
                    }}
                  >
                    <CardContent className="p-0">
                      <div className="p-3 flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                          node.actionType === "classify_ai" ? "bg-purple-400/15" :
                          node.actionType === "wait_response" ? "bg-amber-400/15" :
                          node.actionType === "send_template" ? "bg-primary/15" : "bg-blue-400/15"
                        )}>
                          <ActionIcon className={cn("h-4 w-4", actionInfo?.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-xs">{actionInfo?.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {node.actionType === "send_template" && node.config.template_name ? node.config.template_name :
                             node.actionType === "wait_response" ? `Timeout: ${node.config.timeout || "1"}${node.config.timeout_unit === "min" ? " min" : "h"}` :
                             node.actionType === "classify_ai" ? (node.config.labels || "Positivo, Neutro, Negativo") :
                             node.actionType === "move_stage" && node.config.stage_name ? node.config.stage_name :
                             "Clique para configurar"}
                          </p>
                        </div>
                        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Classify AI label badges */}
                      {node.actionType === "classify_ai" && (
                        <div className="px-3 pb-2.5 flex gap-1.5 justify-center flex-wrap">
                          {parseLabels(node.config.labels || "Positivo, Neutro, Negativo").slice(0, 4).map((label, li) => (
                            <Badge key={li} className={cn("text-[10px]", BRANCH_COLORS[li % BRANCH_COLORS.length].badge)}>
                              {label.substring(0, 10)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Render branches after classify_ai */}
                  {node.actionType === "classify_ai" && node.config.branches && (
                    <div onClick={(e) => e.stopPropagation()}>
                      {renderBranches(node)}
                    </div>
                  )}

                  {i < flowNodes.length - 1 && <div className="w-px h-6 bg-border" />}
                </div>
              );
            })}

            {/* Add action hint */}
            <button
              onClick={() => addAction("send_template")}
              className="w-64 border-2 border-dashed border-border/50 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors mt-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar etapa
            </button>
          </div>
        </div>

        {/* Right side panel - config */}
        {showTriggerConfig && selectedTrigger === "new_order" && (
          <NewOrderTriggerConfigPanel
            config={triggerConfig}
            onClose={closeSidePanel}
            onUpdateConfig={(config) => setTriggerConfig((prev) => ({ ...prev, ...config }))}
          />
        )}

        {showTriggerConfig && selectedTrigger === "scheduled" && (
          <ScheduledTriggerConfigPanel
            config={triggerConfig}
            onClose={closeSidePanel}
            onUpdateConfig={(config) => setTriggerConfig((prev) => ({ ...prev, ...config }))}
          />
        )}

        {selectedNode && !showTriggerConfig && (
          <NodeConfigPanel
            node={selectedNode}
            title={ACTIONS.find((a) => a.type === selectedNode.actionType)?.label || "Configurar"}
            onClose={closeSidePanel}
            onUpdateConfig={(config) => updateNodeConfig(selectedNode.id, config)}
            templates={templates}
            stages={stages}
          />
        )}

        {selectedBranchNode && selectedBranchParentNode && selectedBranchAction && (
          <BranchNodeConfigPanel
            parentNode={selectedBranchParentNode}
            label={selectedBranchAction.label}
            actionIndex={selectedBranchAction.actionIndex}
            branchNode={selectedBranchNode}
            onClose={closeSidePanel}
            onUpdateConfig={(config) => updateBranchNodeConfig(
              selectedBranchAction.nodeId,
              selectedBranchAction.label,
              selectedBranchAction.actionIndex,
              config
            )}
            onRemove={() => removeBranchAction(
              selectedBranchAction.nodeId,
              selectedBranchAction.label,
              selectedBranchAction.actionIndex
            )}
            templates={templates}
            stages={stages}
          />
        )}
      </div>
    );
  }

  // ── List View ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          
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
