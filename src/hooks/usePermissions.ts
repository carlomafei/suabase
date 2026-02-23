import { useTenant } from "./useTenant";
import { useAuth } from "./useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TenantRole = "owner" | "admin" | "supervisor" | "member" | "atendente" | "viewer";

const ROLE_HIERARCHY: Record<TenantRole, number> = {
  owner: 6,
  admin: 5,
  supervisor: 4,
  member: 3,
  atendente: 2,
  viewer: 1,
};

const ROLE_LABELS: Record<TenantRole, string> = {
  owner: "Admin do Tenant",
  admin: "Admin",
  supervisor: "Gestor/Supervisor",
  member: "Operador",
  atendente: "Atendente",
  viewer: "Visualizador",
};

// Permission matrix: what each minimum role can do
const PERMISSIONS = {
  // Admin do Tenant (owner/admin)
  manage_team: "admin",
  configure_integrations: "admin",
  create_automations: "admin",
  delete_contacts: "admin",
  delete_deals: "admin",
  manage_settings: "admin",

  // Gestor/Supervisor
  view_metrics: "supervisor",
  view_team_performance: "supervisor",

  // Operador (member)
  use_crm: "member",
  manage_contacts: "member",
  manage_deals: "member",
  move_deal_stages: "member",

  // Atendente
  send_messages: "atendente",
  view_contacts: "atendente",

  // Viewer
  view_dashboard: "viewer",
  view_orders: "viewer",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const usePermissions = () => {
  const { role, loading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkSuperAdmin = async () => {
      const { data } = await supabase
        .from("super_admins" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsSuperAdmin(!!data);
      setLoading(tenantLoading);
    };

    checkSuperAdmin();
  }, [user, tenantLoading]);

  const currentRole = (role as TenantRole) || "viewer";
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 0;

  const hasMinRole = (minRole: TenantRole): boolean => {
    if (isSuperAdmin) return true;
    return currentLevel >= (ROLE_HIERARCHY[minRole] ?? 99);
  };

  const can = (permission: Permission): boolean => {
    if (isSuperAdmin) return true;
    const minRole = PERMISSIONS[permission] as TenantRole;
    return hasMinRole(minRole);
  };

  return {
    role: currentRole,
    roleLabel: ROLE_LABELS[currentRole] ?? currentRole,
    isSuperAdmin,
    can,
    hasMinRole,
    loading: loading || tenantLoading,
    allRoles: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value: value as TenantRole, label })),
  };
};
