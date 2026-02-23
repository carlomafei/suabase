import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";

export interface PlanLimits {
  max_contacts: number;
  max_whatsapp_sends: number;
  max_users: number;
  max_pipelines: number;
  automations: boolean;
  analytics_advanced: boolean;
  white_label: boolean;
  api_access: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  limits: PlanLimits;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  canceled_at: string | null;
}

export interface UsageMetric {
  metric: string;
  current_value: number;
  limit_value: number | null; // null = unlimited
}

export const usePlan = () => {
  const { tenantId } = useTenant();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [plansRes, subRes, usageRes] = await Promise.all([
      supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).single(),
      supabase.from("usage_tracking").select("*").eq("tenant_id", tenantId).eq("period", currentPeriod),
    ]);

    const allPlans = (plansRes.data || []).map((p: any) => ({
      ...p,
      limits: p.limits as PlanLimits,
      features: p.features as string[],
    }));
    setPlans(allPlans);

    if (subRes.data) {
      setSubscription(subRes.data as Subscription);
      const plan = allPlans.find((p: Plan) => p.id === subRes.data.plan_id);
      setCurrentPlan(plan || null);
    }

    setUsage(
      (usageRes.data || []).map((u: any) => ({
        metric: u.metric,
        current_value: u.current_value,
        limit_value: u.limit_value,
      }))
    );

    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const canUseFeature = (feature: keyof PlanLimits): boolean => {
    if (!currentPlan) return false;
    return !!currentPlan.limits[feature];
  };

  const isWithinLimit = (metric: string): boolean => {
    const u = usage.find((m) => m.metric === metric);
    if (!u) return true;
    if (u.limit_value === null || u.limit_value === -1) return true;
    return u.current_value < u.limit_value;
  };

  const getUsagePercent = (metric: string): number => {
    const u = usage.find((m) => m.metric === metric);
    if (!u || !u.limit_value || u.limit_value === -1) return 0;
    return Math.min(100, Math.round((u.current_value / u.limit_value) * 100));
  };

  return {
    plans,
    subscription,
    currentPlan,
    usage,
    loading,
    canUseFeature,
    isWithinLimit,
    getUsagePercent,
    refetch: fetchData,
  };
};
