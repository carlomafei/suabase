import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BlingOrder {
  id: number;
  numero: string;
  data: string;
  totalProdutos: number;
  contato: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
    email?: string;
    fone?: string;
  };
  situacao: { valor: number; descricao: string };
}

const BLING_API = "https://www.bling.com.br/Api/v3";

async function blingFetch(path: string, accessToken: string) {
  const res = await fetch(`${BLING_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bling API ${res.status}: ${body}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(authHeader.replace("Bearer ", ""));

    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Bling credentials
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("id, credentials, sync_cursor")
      .eq("tenant_id", tenant_id)
      .eq("provider", "bling")
      .eq("is_active", true)
      .single();

    if (!integration?.credentials) {
      return new Response(
        JSON.stringify({ error: "Integração Bling não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let creds = integration.credentials as Record<string, string>;
    let accessToken = creds.access_token;
    const cursor = (integration as any).sync_cursor || null;

    // Auto-refresh token if expired
    if (creds.expires_at && new Date(creds.expires_at) <= new Date()) {
      if (!creds.refresh_token || !creds.client_id || !creds.client_secret) {
        return new Response(
          JSON.stringify({ error: "Token expirado e refresh não disponível" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${creds.client_id}:${creds.client_secret}`);
      const refreshRes = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: creds.refresh_token,
        }),
      });

      if (!refreshRes.ok) {
        const errBody = await refreshRes.text();
        console.error("Bling token refresh failed:", errBody);
        return new Response(
          JSON.stringify({ error: "Falha ao renovar token do Bling", details: errBody }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await refreshRes.json();
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      creds = {
        ...creds,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
      };

      await supabase
        .from("tenant_integrations")
        .update({ credentials: creds as any, updated_at: new Date().toISOString() })
        .eq("id", integration.id);

      accessToken = tokenData.access_token;
    }

    // Incremental sync: fetch orders modified after cursor
    let path = "/pedidos/vendas?pagina=1&limite=100&criterio=3";
    if (cursor) {
      path += `&dataAlteracaoInicio=${cursor}`;
    }

    const result = await blingFetch(path, accessToken);
    const orders: BlingOrder[] = result?.data || [];

    let synced = 0;
    let skipped = 0;
    let newContacts = 0;

    for (const order of orders) {
      const blingId = String(order.id);

      // 1. Idempotency check by bling_id (external_id)
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("external_id", blingId)
        .maybeSingle();

      // 2. Upsert contact with CPF normalization (handled by DB trigger)
      let contactId: string | null = null;
      if (order.contato) {
        const cpf = order.contato.cpf_cnpj?.replace(/[^0-9]/g, "") || null;

        // Deduplication: find by CPF first
        if (cpf) {
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("cpf_cnpj", cpf)
            .maybeSingle();

          if (existingContact) {
            contactId = existingContact.id;
          }
        }

        if (!contactId) {
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({
              tenant_id,
              name: order.contato.nome,
              cpf_cnpj: cpf,
              email: order.contato.email || null,
              phone: order.contato.fone || null,
              external_id: String(order.contato.id),
              source: "bling",
            })
            .select("id")
            .single();

          if (newContact) {
            contactId = newContact.id;
            newContacts++;
          }
        }
      }

      if (existing) {
        // Update existing order
        await supabase
          .from("orders")
          .update({
            status: order.situacao?.descricao || "pendente",
            total_value: order.totalProdutos || 0,
            contact_id: contactId,
            order_date: order.data || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        skipped++;
      } else {
        // Insert new order
        await supabase.from("orders").insert({
          tenant_id,
          external_id: blingId,
          contact_id: contactId,
          total_value: order.totalProdutos || 0,
          status: order.situacao?.descricao || "pendente",
          order_date: order.data || null,
          marketplace: "bling",
          synced_from: "bling",
          metadata: { bling_numero: order.numero } as any,
        });
        synced++;
      }
    }

    // Update sync cursor
    const newCursor = new Date().toISOString().split("T")[0];
    await supabase
      .from("tenant_integrations")
      .update({
        sync_cursor: newCursor,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        updated: skipped,
        new_contacts: newContacts,
        total_fetched: orders.length,
        cursor: newCursor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("bling-sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
