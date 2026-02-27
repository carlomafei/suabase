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

// Deskdata adapter
async function queryDeskdata(
  username: string,
  password: string,
  cpf?: string,
  nome?: string
): Promise<BrokerResult> {
  // Step 1: Authenticate
  const authRes = await fetch("https://api.deskdata.com.br/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!authRes.ok) throw new Error(`Deskdata auth ${authRes.status}`);
  const authData = await authRes.json();
  const accessToken = authData.access_token;
  if (!accessToken) throw new Error("Deskdata: access_token não retornado");

  // Step 2: Query
  const keyType = cpf ? "cpf" : nome ? "name" : null;
  const keyValue = cpf || nome;
  if (!keyType || !keyValue) throw new Error("CPF ou nome obrigatório para Deskdata");

  const queryRes = await fetch("https://api.deskdata.com.br/queries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      type: "persons",
      key_type: keyType,
      key_value: keyValue.replace(/[^0-9a-zA-ZÀ-ú ]/g, ""),
      datasets: ["basic", "phones", "emails"],
    }),
  });

  if (!queryRes.ok) throw new Error(`Deskdata query ${queryRes.status}`);
  const queryData = await queryRes.json();

  if (queryData.status?.code !== 4000) {
    throw new Error(`Deskdata: ${queryData.status?.message || "Erro desconhecido"}`);
  }

  const data = queryData.data || {};
  const phones = data.phones?.items || [];
  const emails = data.emails?.items || [];

  // Extract: first mobile → whatsapp, first landline → phone, first email → email
  const mobile = phones.find((p: any) => p.type === "MOBILE" || p.type === "mobile") || phones[0];
  const landline = phones.find((p: any) => p.type === "LANDLINE" || p.type === "landline");
  const firstEmail = emails[0];

  return {
    whatsapp: mobile?.number || null,
    email: firstEmail?.email || null,
    phone: landline?.number || mobile?.number || null,
    metadata: { provider: "deskdata", raw: data },
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

    // Check for Deskdata provider first
    const { data: deskdataIntegration } = await supabase
      .from("tenant_integrations")
      .select("credentials, settings")
      .eq("tenant_id", tenant_id)
      .eq("provider", "deskdata")
      .eq("is_active", true)
      .single();

    // Fallback to generic data_broker
    const { data: genericIntegration } = await supabase
      .from("tenant_integrations")
      .select("credentials, settings")
      .eq("tenant_id", tenant_id)
      .eq("provider", "data_broker")
      .eq("is_active", true)
      .single();

    let result: BrokerResult;

    if (deskdataIntegration?.credentials) {
      const creds = deskdataIntegration.credentials as Record<string, string>;
      result = await queryDeskdata(
        creds.username,
        creds.password,
        cpf || undefined,
        nome || undefined
      );
    } else if (genericIntegration?.credentials) {
      const creds = genericIntegration.credentials as Record<string, string>;
      const settings = (genericIntegration.settings || {}) as Record<string, string>;
      const providerType = settings.provider_type || "generic";
      result = await findContacts(
        providerType,
        creds.api_url,
        creds.api_key,
        cpf || undefined,
        nome || undefined
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Data Broker não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
