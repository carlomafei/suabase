import { usePlan } from "@/hooks/usePlan";
import { useTenant } from "@/hooks/useTenant";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Check, Crown, Rocket, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const METRIC_LABELS: Record<string, string> = {
  contacts: "Contatos",
  whatsapp_sends: "Envios WhatsApp",
  users: "Usuários",
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="h-6 w-6" />,
  growth: <Rocket className="h-6 w-6" />,
  scale: <Crown className="h-6 w-6" />,
};

const PlanSettings = () => {
  const { plans, subscription, currentPlan, usage, loading, getUsagePercent } = usePlan();
  const { role } = useTenant();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const isOwnerOrAdmin = role === "owner" || role === "admin";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold mb-2">Plano & Uso</h2>
        <p className="text-muted-foreground">Gerencie seu plano e acompanhe o consumo</p>
      </div>

      {/* Current plan summary */}
      {currentPlan && subscription && (
        <div className="card-gradient rounded-xl border border-primary/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {PLAN_ICONS[currentPlan.slug] || <Zap className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">{currentPlan.name}</h3>
                <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
              </div>
            </div>
            <Badge variant={subscription.status === "active" ? "default" : "destructive"}>
              {subscription.status === "active" ? "Ativo" : subscription.status}
            </Badge>
          </div>

          <Separator className="my-4" />

          {/* Usage meters */}
          <div className="grid gap-4 sm:grid-cols-3">
            {usage.map((u) => {
              const pct = getUsagePercent(u.metric);
              const isNearLimit = pct >= 80;
              const isUnlimited = u.limit_value === null || u.limit_value === -1;
              return (
                <div key={u.metric} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{METRIC_LABELS[u.metric] || u.metric}</span>
                    <span className="text-muted-foreground">
                      {isUnlimited
                        ? `${u.current_value} / ∞`
                        : `${u.current_value} / ${u.limit_value}`}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="relative">
                      <Progress value={pct} className="h-2" />
                      {isNearLimit && (
                        <AlertTriangle className="absolute -top-0.5 -right-1 h-3 w-3 text-destructive" />
                      )}
                    </div>
                  )}
                  {isUnlimited && (
                    <div className="h-2 rounded-full bg-primary/20" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Ciclo: {subscription.billing_cycle === "monthly" ? "Mensal" : "Anual"}</span>
            <span>
              R$ {Number(currentPlan.price_monthly).toFixed(2).replace(".", ",")}/mês
            </span>
          </div>
        </div>
      )}

      {/* Plan comparison */}
      <div>
        <h3 className="font-display font-semibold text-lg mb-4">Planos disponíveis</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "card-gradient rounded-xl border p-6 flex flex-col",
                  isCurrent ? "border-primary/50 ring-1 ring-primary/30" : "border-border/50"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      isCurrent ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {PLAN_ICONS[plan.slug] || <Zap className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="font-display font-bold">{plan.name}</h4>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        Atual
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-2xl font-bold mb-1">
                  R$ {Number(plan.price_monthly).toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isOwnerOrAdmin && !isCurrent && (
                  <Button
                    variant={plan.sort_order > (currentPlan?.sort_order ?? 0) ? "default" : "outline"}
                    className="w-full"
                    onClick={() => {
                      // Future: integrate with payment gateway
                    }}
                  >
                    {plan.sort_order > (currentPlan?.sort_order ?? 0) ? "Fazer upgrade" : "Downgrade"}
                  </Button>
                )}
                {isCurrent && (
                  <Button variant="outline" className="w-full" disabled>
                    Plano atual
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlanSettings;
