import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";
// Datafy is a mirror of the Meta Cloud API: same paths and bodies, different base URL and token.
// Docs: https://developers.datafyapi.com.br/api-reference/whatsapp/introducao
const DATAFY_API_URL = "https://cloud.datafyapi.com.br/v1";
// Deliveries older than this are refused (replay protection, as recommended by Datafy).
const DATAFY_MAX_SKEW_SECONDS = 300;

type WhatsAppProvider = "whatsapp_datafy" | "whatsapp_meta";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);

  // ─── WEBHOOK VERIFICATION (GET, Meta only) ───
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      const { data: integrations } = await supabase
        .from("tenant_integrations")
        .select("credentials")
        .eq("provider", "whatsapp_meta")
        .eq("is_active", true);

      const valid = integrations?.some((i: any) => {
        const creds = i.credentials as Record<string, string>;
        return creds?.webhook_verify_token === token;
      });

      if (valid) {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      // Read the raw body first: the Datafy signature is computed over the exact bytes received.
      const rawBody = await req.text();

      // ─── WEBHOOK FROM DATAFY (signed) ───
      if (req.headers.get("x-datafy-signature-256")) {
        return await handleDatafyWebhook(supabase, req, rawBody);
      }

      let body: any;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      // ─── WEBHOOK FROM META (no Authorization header) ───
      const authHeader = req.headers.get("Authorization");
      const isMetaWebhook = !authHeader && body?.object === "whatsapp_business_account";
      if (isMetaWebhook) {
        await processWebhookPayload(supabase, body, "whatsapp_meta");
        return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
      }

      // ─── SEND TEMPLATE (POST from frontend) ───
      return await handleSendTemplate(supabase, req, body);
    } catch (err: any) {
      console.error("whatsapp error:", err);
      return new Response(
        JSON.stringify({ error: err.message || "Erro interno" }),
        { status: 500, headers: jsonHeaders }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

// ─── DATAFY WEBHOOK: SIGNATURE CHECK ───
// signature = "sha256=" + hex(HMAC-SHA256(webhook_secret, `${timestamp}.${rawBody}`))
// https://developers.datafyapi.com.br/api-reference/whatsapp/webhooks/validar-assinatura
async function handleDatafyWebhook(supabase: any, req: Request, rawBody: string) {
  const signature = req.headers.get("x-datafy-signature-256") ?? "";
  const timestamp = req.headers.get("x-datafy-timestamp") ?? "";
  const deliveryId = req.headers.get("x-datafy-delivery-id") ?? "";

  const ts = Number(timestamp);
  if (!timestamp || !Number.isFinite(ts) ||
      Math.abs(Math.floor(Date.now() / 1000) - ts) > DATAFY_MAX_SKEW_SECONDS) {
    return new Response("Invalid timestamp", { status: 401, headers: corsHeaders });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  // The secret is per number, so find the integrations for the numbers in this payload
  // and accept the delivery if one of their secrets produces the received signature.
  const phoneNumberIds = collectPhoneNumberIds(body);
  if (phoneNumberIds.length === 0) {
    // Events without a phone number (e.g. template/account updates) are not processed here.
    // Acknowledge so Datafy does not retry them.
    return new Response(JSON.stringify({ success: true, ignored: true }), { headers: jsonHeaders });
  }

  const { data: integrations } = await supabase
    .from("tenant_integrations")
    .select("tenant_id, credentials")
    .eq("provider", "whatsapp_datafy")
    .eq("is_active", true)
    .in("credentials->>phone_number_id", phoneNumberIds);

  let verified = false;
  for (const integration of integrations || []) {
    const secret = (integration.credentials as Record<string, string>)?.webhook_secret;
    if (!secret) continue;
    const expected = "sha256=" + await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
    if (timingSafeEqual(expected, signature)) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    console.warn("Datafy webhook: invalid signature", { deliveryId, phoneNumberIds });
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  // Datafy expects a 200 within 20s: process in the background when the runtime allows it.
  const work = processWebhookPayload(supabase, body, "whatsapp_datafy").catch((err) =>
    console.error("Datafy webhook processing error:", { deliveryId, err })
  );
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
  } else {
    await work;
  }

  return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
}

function collectPhoneNumberIds(body: any): string[] {
  const ids = new Set<string>();
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const id = change?.value?.metadata?.phone_number_id;
      if (id) ids.add(String(id));
    }
  }
  return [...ids];
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── PROCESS WEBHOOK PAYLOAD (same format for Meta and Datafy) ───
async function processWebhookPayload(supabase: any, body: any, provider: WhatsAppProvider) {
  const entries = body?.entry || [];

  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Find tenant by phone_number_id
      const { data: integration } = await supabase
        .from("tenant_integrations")
        .select("tenant_id, credentials")
        .eq("provider", provider)
        .eq("is_active", true)
        .eq("credentials->>phone_number_id", String(phoneNumberId))
        .maybeSingle();

      if (!integration) continue;

      const tenantId = integration.tenant_id;

      // Process messages
      const messages = value.messages || [];
      for (const msg of messages) {
        const fromPhone = msg.from;
        const providerMsgId = msg.id;
        const content = msg.text?.body || msg.type || "";

        // Retries resend the same message: skip if already stored.
        if (providerMsgId) {
          const { data: existingMsg } = await supabase
            .from("messages")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("provider_message_id", providerMsgId)
            .maybeSingle();
          if (existingMsg) continue;
        }

        // Find or create contact by whatsapp number
        let contactId: string | null = null;
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("whatsapp", fromPhone)
          .maybeSingle();

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({
              tenant_id: tenantId,
              name: value.contacts?.[0]?.profile?.name || fromPhone,
              whatsapp: fromPhone,
              source: "whatsapp",
            })
            .select("id")
            .single();
          contactId = newContact?.id || null;
        }

        // Store inbound message
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          contact_id: contactId,
          channel: "whatsapp",
          direction: "inbound",
          content,
          status: "received",
          sent_at: new Date().toISOString(),
          provider_message_id: providerMsgId,
          metadata: { from: fromPhone, type: msg.type, provider } as any,
        });
      }

      // Process status updates
      const statuses = value.statuses || [];
      for (const status of statuses) {
        const providerMsgId = status.id;
        const newStatus = status.status; // sent, delivered, read, failed

        await supabase
          .from("messages")
          .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
          .eq("tenant_id", tenantId)
          .eq("provider_message_id", providerMsgId);
      }
    }
  }
}

// ─── HANDLE SEND TEMPLATE ───
async function handleSendTemplate(supabase: any, req: Request, body: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const { tenant_id, contact_id, template_name, template_language, variables } = body;

  if (!tenant_id || !contact_id || !template_name) {
    return new Response(
      JSON.stringify({ error: "tenant_id, contact_id e template_name obrigatórios" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Get WhatsApp credentials: prefer Datafy, fall back to Meta direct.
  const { data: integrations } = await supabase
    .from("tenant_integrations")
    .select("provider, credentials")
    .eq("tenant_id", tenant_id)
    .in("provider", ["whatsapp_datafy", "whatsapp_meta"])
    .eq("is_active", true);

  const integration =
    integrations?.find((i: any) => i.provider === "whatsapp_datafy") ??
    integrations?.find((i: any) => i.provider === "whatsapp_meta");

  if (!integration?.credentials) {
    return new Response(
      JSON.stringify({ error: "WhatsApp não configurado" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  const provider = integration.provider as WhatsAppProvider;
  const creds = integration.credentials as Record<string, string>;
  const baseUrl = provider === "whatsapp_datafy" ? DATAFY_API_URL : META_GRAPH_URL;
  const token = provider === "whatsapp_datafy" ? creds.api_token : creds.access_token;

  if (!creds.phone_number_id || !token) {
    return new Response(
      JSON.stringify({ error: "Credenciais do WhatsApp incompletas" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Get contact WhatsApp number
  const { data: contact } = await supabase
    .from("contacts")
    .select("whatsapp, name, opt_out_whatsapp")
    .eq("id", contact_id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!contact?.whatsapp) {
    return new Response(
      JSON.stringify({ error: "Contato sem WhatsApp" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Check opt-out
  if (contact.opt_out_whatsapp) {
    return new Response(
      JSON.stringify({ error: "Contato fez opt-out de WhatsApp" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Templates can always be sent (they are pre-approved by Meta), even outside the 24h window.

  // Build template components
  const components: any[] = [];
  if (variables && variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map((v: string) => ({ type: "text", text: v })),
    });
  }

  const apiRes = await fetch(`${baseUrl}/${creds.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: contact.whatsapp,
      type: "template",
      template: {
        name: template_name,
        language: { code: template_language || "pt_BR" },
        components: components.length > 0 ? components : undefined,
      },
    }),
  });

  const apiData = await apiRes.json().catch(() => ({}));

  if (!apiRes.ok) {
    // Datafy's own errors come as { statusCode, message } (401 token, 402 subscription,
    // 403 blocked, 409 paused channel, 429 rate limit); Meta errors are passed through.
    console.error(`${provider} API error:`, apiRes.status, apiData);
    const message =
      apiData?.error?.message || apiData?.message || "Erro ao enviar mensagem";
    return new Response(
      JSON.stringify({ error: `Erro ao enviar via WhatsApp: ${message}`, details: apiData }),
      { status: apiRes.status === 429 ? 429 : 502, headers: jsonHeaders }
    );
  }

  const providerMessageId = apiData.messages?.[0]?.id || null;

  // Store outbound message
  await supabase.from("messages").insert({
    tenant_id,
    contact_id,
    channel: "whatsapp",
    direction: "outbound",
    content: `[Template: ${template_name}]`,
    status: "sent",
    sent_at: new Date().toISOString(),
    provider_message_id: providerMessageId,
    metadata: {
      provider,
      template_name,
      template_language: template_language || "pt_BR",
      variables,
      api_response: apiData,
    } as any,
  });

  return new Response(
    JSON.stringify({
      success: true,
      provider_message_id: providerMessageId,
    }),
    { headers: jsonHeaders }
  );
}
