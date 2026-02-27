import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller identity
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Check super admin
    const { data: isSA } = await anonClient.rpc("is_super_admin", { _user_id: userId });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action } = await req.json();

    if (action === "list_tenants") {
      const { data: tenants, error } = await adminClient
        .from("tenants")
        .select("id, name, slug, plan, is_active, created_at")
        .order("name");
      if (error) throw error;
      return new Response(JSON.stringify({ tenants }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_users") {
      // Get all users from auth admin API
      const allUsers: any[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({
          page,
          perPage,
        });
        if (error) throw error;
        allUsers.push(...users);
        if (users.length < perPage) break;
        page++;
      }

      // Get profiles
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, full_name");

      // Get tenant_users with tenant name
      const { data: tenantUsers } = await adminClient
        .from("tenant_users")
        .select("user_id, role, tenant_id, is_active, tenants(name)");

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const tuMap = new Map<string, any[]>();
      for (const tu of tenantUsers || []) {
        const arr = tuMap.get(tu.user_id) || [];
        arr.push(tu);
        tuMap.set(tu.user_id, arr);
      }

      const users = allUsers.map((u) => {
        const profile = profileMap.get(u.id);
        const memberships = tuMap.get(u.id) || [];
        return {
          user_id: u.id,
          email: u.email,
          full_name: profile?.full_name || "",
          created_at: u.created_at,
          memberships: memberships.map((m: any) => ({
            tenant_name: m.tenants?.name || "—",
            role: m.role,
            is_active: m.is_active,
          })),
        };
      });

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "global_metrics") {
      const [tenantsRes, contactsRes, usersRes, subsRes] = await Promise.all([
        adminClient.from("tenants").select("id", { count: "exact", head: true }),
        adminClient.from("contacts").select("id", { count: "exact", head: true }),
        adminClient.from("profiles").select("id", { count: "exact", head: true }),
        adminClient
          .from("subscriptions")
          .select("plan_id, plans(price_monthly)")
          .eq("status", "active"),
      ]);

      const mrr = (subsRes.data || []).reduce((sum: number, s: any) => {
        return sum + (s.plans?.price_monthly || 0);
      }, 0);

      return new Response(
        JSON.stringify({
          metrics: {
            total_tenants: tenantsRes.count || 0,
            total_users: usersRes.count || 0,
            total_contacts: contactsRes.count || 0,
            mrr,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
