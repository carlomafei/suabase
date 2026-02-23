import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Generic Data Broker Interface
 * 
 * Supports providers: neoway, assertiva, bigdatacorp
 * Normalized interface: findContacts({ cpf, nome })
 * Returns: { whatsapp, email, phone, endereco, score }
 */

interface BrokerRequest {
  tenant_id: string;
  contact_id: string;
  cpf?: string;
  nome?: string;
}

interface BrokerResult {
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, any>;
}

// Provider adapters
async function queryNeoway(
  apiUrl: string,
  apiKey: string,
  cpf?: string,
  nome?: string
): Promise<BrokerResult> {
  const params = new URLSearchParams();
  if (cpf) params.set("cpf", cpf);
  if (nome) params.set("nome", nome);

  const res = await fetch(`${apiUrl}/v1/people?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) throw new Error(`Neoway ${res.status}`);
  const data = await res.json();

  return {
    whatsapp: data.celular || null,
    email: data.email || null,
    phone: data.telefone || null,
    metadata: { provider: "neoway", score: data.score, endereco: data.endereco },
  };
}

async function queryAssertiva(
  apiUrl: string,
  apiKey: string,
  cpf?: string,
  nome?: string
): Promise<BrokerResult> {
  const res = await fetch(`${apiUrl}/localize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ documento: cpf, nome }),
  });

  if (!res.ok) throw new Error(`Assertiva ${res.status}`);
  const data = await res.json();

  return {
    whatsapp: data.celulares?.[0] || null,
    email: data.emails?.[0] || null,
    phone: data.telefones?.[0] || null,
    metadata: { provider: "assertiva", raw: data },
  };
}

async function queryBigDataCorp(
  apiUrl: string,
  apiKey: string,
  cpf?: string,
  nome?: string
): Promise<BrokerResult> {
  const params: Record<string, string> = {};
  if (cpf) params.doc = cpf;
  if (nome) params.q = nome;

  const qs = new URLSearchParams(params);
  const res = await fetch(`${apiUrl}/pessoas?${qs}`, {
    headers: { "AccessToken": apiKey },
  });

  if (!res.ok) throw new Error(`BigDataCorp ${res.status}`);
  const data = await res.json();
  const person = data.Result?.[0]?.BasicData || {};

  return {
    whatsapp: person.PhoneList?.[0]?.Number || null,
    email: person.EmailList?.[0]?.EmailAddress || null,
    phone: person.PhoneList?.[1]?.Number || null,
    metadata: { provider: "bigdatacorp", raw: person },
  };
}

// Generic dispatcher
async function findContacts(
  providerType: string,
  apiUrl: string,
  apiKey: string,
  cpf?: string,
  nome?: string
): Promise<BrokerResult> {
  switch (providerType) {
    case "neoway":
      return queryNeoway(apiUrl, apiKey, cpf, nome);
    case "assertiva":
      return queryAssertiva(apiUrl, apiKey, cpf, nome);
    case "bigdatacorp":
      return queryBigDataCorp(apiUrl, apiKey, cpf, nome);
    default:
      // Fallback: generic REST call
      const res = await fetch(`${apiUrl}/find`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf, nome }),
      });
      if (!res.ok) throw new Error(`Broker ${res.status}`);
      const data = await res.json();
      return {
        whatsapp: data.whatsapp || data.celular || null,
        email: data.email || null,
        phone: data.phone || data.telefone || null,
        metadata: { provider: providerType, raw: data },
      };
  }
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

    const { tenant_id, contact_id, cpf, nome }: BrokerRequest = await req.json();

    if (!tenant_id || !contact_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id e contact_id obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get data broker credentials
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("credentials, settings")
      .eq("tenant_id", tenant_id)
      .eq("provider", "data_broker")
      .eq("is_active", true)
      .single();

    if (!integration?.credentials) {
      return new Response(
        JSON.stringify({ error: "Data Broker não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creds = integration.credentials as Record<string, string>;
    const settings = (integration.settings || {}) as Record<string, string>;
    const providerType = settings.provider_type || "generic";

    const result = await findContacts(
      providerType,
      creds.api_url,
      creds.api_key,
      cpf || undefined,
      nome || undefined
    );

    // Update contact with enriched data
    const updateData: Record<string, any> = {
      enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (result.whatsapp) updateData.whatsapp = result.whatsapp;
    if (result.email) updateData.email = result.email;
    if (result.phone) updateData.phone = result.phone;
    if (result.metadata) updateData.metadata = result.metadata;

    await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", contact_id)
      .eq("tenant_id", tenant_id);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("data-broker error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
