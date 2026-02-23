import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useTenant = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchTenant = async () => {
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, tenants(name)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (data && !error) {
        setTenantId(data.tenant_id);
        setRole(data.role);
        setTenantName((data as any).tenants?.name ?? "");
      }
      setLoading(false);
    };

    fetchTenant();
  }, [user]);

  return { tenantId, tenantName, role, loading };
};
