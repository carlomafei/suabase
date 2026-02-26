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

interface BlingOrderDetail {
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
  itens: Array<{
    descricao: string;
    quantidade: number;
    valorUnidade: number;
    produto?: { id: number; nome?: string };
  }>;
  loja?: { id: number; nome?: string };
  canal?: string;
  numeroLojaVirtual?: string;
}

const BLING_API = "https://www.bling.com.br/Api/v3";

// Status mapping from Bling to internal system
const STATUS_MAP: Record<string, string> = {
  "Em aberto": "pending",
  "Atendido": "delivered",
  "Cancelado": "canceled",
  "Em andamento": "processing",
  "Enviado": "shipped",
  "Verificado": "processing",
  "Venda Agenciada": "pending",
};

function mapBlingStatus(blingStatus: string | undefined): string {
  if (!blingStatus) return "pending";
  return STATUS_MAP[blingStatus] || "pending";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function fetchOrderDetail(orderId: number, accessToken: string): Promise<BlingOrderDetail | null> {
  try {
    const result = await blingFetch(`/pedidos/vendas/${orderId}`, accessToken);
    return result?.data || null;
  } catch (err: any) {
    console.error(`Failed to fetch order detail ${orderId}:`, err.message);
    return null;
  }
}

async function fetchBlingContact(contactId: number, accessToken: string): Promise<{
  cpf_cnpj?: string; numeroDocumento?: string;
  nome?: string; email?: string; celular?: string; fone?: string;
} | null> {
  try {
    const result = await blingFetch(`/contatos/${contactId}`, accessToken);
    return result?.data || null;
  } catch (err: any) {
    console.warn(`Failed to fetch Bling contact ${contactId}:`, err.message);
    return null;
  }
}

async function refreshTokenIfNeeded(
  supabase: any,
  integration: any,
  creds: Record<string, string>
): Promise<{ accessToken: string; creds: Record<string, string> }> {
  if (creds.expires_at && new Date(creds.expires_at) <= new Date()) {
    if (!creds.refresh_token || !creds.client_id || !creds.client_secret) {
      throw new Error("Token expirado e refresh não disponível");
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
      throw new Error(`Falha ao renovar token do Bling: ${errBody}`);
    }

    const tokenData = await refreshRes.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const newCreds = {
      ...creds,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
    };

    await supabase
      .from("tenant_integrations")
      .update({ credentials: newCreds as any, updated_at: new Date().toISOString() })
      .eq("id", integration.id);

    return { accessToken: tokenData.access_token, creds: newCreds };
  }

  return { accessToken: creds.access_token, creds };
}

async function syncTenant(
  supabase: any,
  tenantId: string,
  integration: any
): Promise<{ synced: number; updated: number; new_contacts: number; total_fetched: number }> {
  let creds = integration.credentials as Record<string, string>;
  const cursor = integration.sync_cursor || null;

  const { accessToken } = await refreshTokenIfNeeded(supabase, integration, creds);

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

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_id", blingId)
      .maybeSingle();

    // Fetch order detail to get items, real status, and marketplace
    const detail = await fetchOrderDetail(order.id, accessToken);
    // Rate limiting: small delay between detail API calls
    await delay(150);

    // Extract items from detail
    const items = (detail?.itens || []).map((item) => ({
      descricao: item.descricao || item.produto?.nome || "Produto sem nome",
      quantidade: item.quantidade || 1,
      valor: item.valorUnidade || 0,
    }));

    // Map status from Bling to internal
    const mappedStatus = mapBlingStatus(detail?.situacao?.descricao || order.situacao?.descricao);

    // Extract marketplace from detail
    const marketplace = detail?.loja?.nome || detail?.canal || "bling";
    const numeroLojaVirtual = detail?.numeroLojaVirtual || null;

    // Upsert contact with 3-tier deduplication
    let contactId: string | null = null;
    if (order.contato) {
      const blingContactId = String(order.contato.id);

      // Dados iniciais do pedido (fallback)
      let contactName = order.contato.nome;
      let cpf: string | null = order.contato.cpf_cnpj?.replace(/[^0-9]/g, "") || null;
      let email: string | null = order.contato.email || null;
      let phone: string | null = order.contato.fone || null;

      // SEMPRE buscar dados completos do cadastro de Clientes/Fornecedores do Bling
      if (order.contato.id) {
        const blingContact = await fetchBlingContact(order.contato.id, accessToken);
        await delay(150); // rate limiting
        if (blingContact) {
          // Dados do cadastro prevalecem sobre dados do pedido
          const rawCpf = blingContact.cpf_cnpj || blingContact.numeroDocumento;
          if (rawCpf) cpf = rawCpf.replace(/[^0-9]/g, "") || cpf;
          if (blingContact.nome) contactName = blingContact.nome;
          if (blingContact.email) email = blingContact.email;
          if (blingContact.celular || blingContact.fone) phone = blingContact.celular || blingContact.fone;
          console.log(`bling-sync: contact ${blingContactId} enriched from registry — cpf: ${cpf ? "yes" : "no"}, email: ${email ? "yes" : "no"}, phone: ${phone ? "yes" : "no"}`);
        }
      }

      // Tier 1: By CPF/CNPJ (most reliable)
      if (cpf) {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("cpf_cnpj", cpf)
          .maybeSingle();
        if (found) contactId = found.id;
      }

      // Tier 2: By external_id (Bling contact ID)
      if (!contactId && blingContactId) {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("external_id", blingContactId)
          .maybeSingle();
        if (found) contactId = found.id;
      }

      // Tier 3: By exact name match
      if (!contactId && contactName) {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("name", contactName)
          .maybeSingle();
        if (found) contactId = found.id;
      }

      // Update existing contact with enriched data from registry
      if (contactId) {
        const updates: Record<string, any> = {};
        if (cpf) updates.cpf_cnpj = cpf;
        if (email) updates.email = email;
        if (phone) updates.phone = phone;
        if (contactName) updates.name = contactName;
        if (Object.keys(updates).length > 0) {
          await supabase.from("contacts").update(updates).eq("id", contactId);
        }
      }

      // Only create if no match found
      if (!contactId) {
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            tenant_id: tenantId,
            name: contactName,
            cpf_cnpj: cpf,
            email: email,
            phone: phone,
            external_id: blingContactId,
            source: "bling",
          })
          .select("id")
          .single();

        if (newContact) {
          contactId = newContact.id;
          newContacts++;

          // Queue enrichment job for the new contact
          try {
            await supabase.from("job_queue").insert({
              tenant_id: tenantId,
              job_type: "enrich_contact",
              payload: { contact_id: newContact.id, cpf: cpf, nome: contactName } as any,
              queue: "default",
              status: "pending",
            });
          } catch (enrichErr: any) {
            console.warn(`bling-sync: failed to queue enrichment for contact ${newContact.id}:`, enrichErr.message);
          }
        }
      }
    }

    if (existing) {
      await supabase
        .from("orders")
        .update({
          status: mappedStatus,
          total_value: order.totalProdutos || 0,
          contact_id: contactId,
          order_date: order.data || null,
          items: items as any,
          marketplace: marketplace,
          metadata: { bling_numero: order.numero, numero_loja_virtual: numeroLojaVirtual } as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      skipped++;
    } else {
      await supabase.from("orders").insert({
        tenant_id: tenantId,
        external_id: blingId,
        contact_id: contactId,
        total_value: order.totalProdutos || 0,
        status: mappedStatus,
        order_date: order.data || null,
        items: items as any,
        marketplace: marketplace,
        synced_from: "bling",
        metadata: { bling_numero: order.numero, numero_loja_virtual: numeroLojaVirtual } as any,
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

  return { synced, updated: skipped, new_contacts: newContacts, total_fetched: orders.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // empty body is ok for cron
    }

    const isCron = body?.cron === true;

    if (isCron) {
      // ===== CRON MODE: sync all active Bling integrations =====
      console.log("bling-sync: CRON mode — syncing all active tenants");

      const { data: integrations, error } = await supabase
        .from("tenant_integrations")
        .select("id, tenant_id, credentials, sync_cursor")
        .eq("provider", "bling")
        .eq("is_active", true);

      if (error) {
        throw new Error(`Failed to fetch integrations: ${error.message}`);
      }

      const results: Array<{ tenant_id: string; success: boolean; data?: any; error?: string }> = [];

      for (const integration of integrations || []) {
        const creds = integration.credentials as Record<string, string> | null;
        if (!creds?.access_token) {
          results.push({ tenant_id: integration.tenant_id, success: false, error: "No access_token" });
          continue;
        }

        try {
          const data = await syncTenant(supabase, integration.tenant_id, integration);
          results.push({ tenant_id: integration.tenant_id, success: true, data });
          console.log(`bling-sync cron: tenant ${integration.tenant_id} — ${data.synced} new, ${data.updated} updated`);
        } catch (err: any) {
          console.error(`bling-sync cron: tenant ${integration.tenant_id} failed:`, err.message);
          results.push({ tenant_id: integration.tenant_id, success: false, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, mode: "cron", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== MANUAL MODE: requires auth + tenant_id =====
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

    const tenant_id = body?.tenant_id;
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

    const syncResult = await syncTenant(supabase, tenant_id, integration);

    return new Response(
      JSON.stringify({
        success: true,
        mode: "manual",
        ...syncResult,
        cursor: new Date().toISOString().split("T")[0],
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
