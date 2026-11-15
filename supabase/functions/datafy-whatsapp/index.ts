// WhatsApp via Datafy (mirror of the Meta Cloud API).
// Adapted to the "taqt" database schema: integrations, messages (contact_phone, message_text,
// from_me, z_api_message_id, media_type) and profiles (user_id -> tenant_id).
//
// Credentials live in public.integrations with provider = 'whatsapp_datafy':
//   credentials = { phone_number_id, api_token: "sk_live_...", webhook_secret: "whsec_..." }
//
// POST with x-datafy-signature-256  -> webhook from Datafy (signature checked)
// POST with Authorization: Bearer   -> send a message from the app
//
// Docs: https://developers.datafyapi.com.br/api-reference/whatsapp/introducao
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const PROVIDER = "whatsapp_datafy";
const DATAFY_API_URL = "https://cloud.datafyapi.com.br/v1";
// Deliveries older than this are refused (replay protection, as recommended by Datafy).
const MAX_SKEW_SECONDS = 300;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Read the raw body first: the signature is computed over the exact bytes received.
    const rawBody = await req.text();

    if (req.headers.get("x-datafy-signature-256")) {
      return await handleWebhook(supabase, req, rawBody);
    }
    return await handleSend(supabase, req, rawBody);
  } catch (err: any) {
    console.error("datafy-whatsapp error:", err);
    return json({ error: err?.message || "Erro interno" }, 500);
  }
});

// ─────────────────────────── WEBHOOK ───────────────────────────
// signature = "sha256=" + hex(HMAC-SHA256(webhook_secret, `${timestamp}.${rawBody}`))
// https://developers.datafyapi.com.br/api-reference/whatsapp/webhooks/validar-assinatura
async function handleWebhook(supabase: any, req: Request, rawBody: string) {
  const signature = req.headers.get("x-datafy-signature-256") ?? "";
  const timestamp = req.headers.get("x-datafy-timestamp") ?? "";
  const deliveryId = req.headers.get("x-datafy-delivery-id") ?? "";

  const ts = Number(timestamp);
  if (!timestamp || !Number.isFinite(ts) ||
      Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SKEW_SECONDS) {
    return json({ error: "Invalid timestamp" }, 401);
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // The secret is per number: load the integrations of the numbers in this payload.
  const phoneNumberIds = collectPhoneNumberIds(body);
  if (phoneNumberIds.length === 0) {
    // Events without a phone number (template/account updates) are not handled; ack so Datafy doesn't retry.
    return json({ ok: true, ignored: true });
  }

  const { data: integrations, error } = await supabase
    .from("integrations")
    .select("tenant_id, credentials")
    .eq("provider", PROVIDER)
    .eq("is_active", true)
    .in("credentials->>phone_number_id", phoneNumberIds);
  if (error) console.error("Error loading integrations:", error);

  // Only integrations whose secret produces the received signature are trusted.
  const verified: { tenant_id: string; phone_number_id: string }[] = [];
  for (const integration of integrations || []) {
    const creds = (integration.credentials || {}) as Record<string, string>;
    if (!creds.webhook_secret) continue;
    const expected = "sha256=" + await hmacSha256Hex(creds.webhook_secret, `${timestamp}.${rawBody}`);
    if (timingSafeEqual(expected, signature)) {
      verified.push({ tenant_id: integration.tenant_id, phone_number_id: String(creds.phone_number_id) });
    }
  }

  if (verified.length === 0) {
    console.warn("Invalid Datafy signature", { deliveryId, phoneNumberIds });
    return json({ error: "Invalid signature" }, 401);
  }

  // Datafy expects 200 within 20s: process in the background when the runtime allows it.
  const work = processPayload(supabase, body, verified).catch((err) =>
    console.error("Datafy webhook processing error:", { deliveryId, err })
  );
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return json({ ok: true });
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

async function processPayload(
  supabase: any,
  body: any,
  verified: { tenant_id: string; phone_number_id: string }[],
) {
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
      const tenants = verified.filter((v) => v.phone_number_id === phoneNumberId);
      if (!value || tenants.length === 0) continue;

      for (const { tenant_id } of tenants) {
        // Inbound messages
        for (const msg of value.messages || []) {
          const wamid = msg.id || null;

          // Retries resend the same message: skip if already stored.
          if (wamid) {
            const { data: existing } = await supabase
              .from("messages")
              .select("id")
              .eq("tenant_id", tenant_id)
              .eq("z_api_message_id", wamid)
              .limit(1);
            if (existing && existing.length > 0) continue;
          }

          const contact = (value.contacts || []).find((c: any) => c.wa_id === msg.from) ||
            value.contacts?.[0];
          const mediaType = msg.type && msg.type !== "text" ? String(msg.type) : null;

          const { error } = await supabase.from("messages").insert({
            tenant_id,
            contact_phone: String(msg.from || "").replace(/\D/g, ""),
            contact_name: contact?.profile?.name || null,
            message_text: extractText(msg),
            from_me: false,
            status: "received",
            z_api_message_id: wamid,
            is_group: false,
            media_type: mediaType,
          });
          if (error) console.error(`Error inserting message for tenant ${tenant_id}:`, error);
        }

        // Status of messages we sent: sent, delivered, read, failed
        for (const status of value.statuses || []) {
          if (!status?.id || !status?.status) continue;
          const { error } = await supabase
            .from("messages")
            .update({ status: status.status })
            .eq("tenant_id", tenant_id)
            .eq("z_api_message_id", status.id);
          if (error) console.error("Error updating status:", error);
        }
      }
    }
  }
}

function extractText(msg: any): string {
  const text =
    msg.text?.body ||
    msg.image?.caption ||
    msg.video?.caption ||
    msg.document?.caption ||
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    msg.reaction?.emoji;
  if (text) return String(text);

  const placeholders: Record<string, string> = {
    image: "[imagem]",
    video: "[vídeo]",
    audio: "[áudio]",
    document: "[documento]",
    sticker: "[figurinha]",
    location: "[localização]",
    contacts: "[contato]",
  };
  return placeholders[msg.type] || "[mensagem]";
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─────────────────────────── SEND ───────────────────────────
// Body:
//   { to: "5511999999999", type: "text", text: "Olá" }
//   { to: "5511999999999", type: "template", template_name: "pedido_enviado",
//     template_language?: "pt_BR", variables?: ["Ana", "#123"] }
// The tenant comes from the logged-in user's profile.
async function handleSend(supabase: any, req: Request, rawBody: string) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Não autorizado" }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "Não autorizado" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return json({ error: "Usuário sem empresa vinculada" }, 403);

  let body: any;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const to = String(body.to || "").replace(/\D/g, "");
  const type = body.type || (body.template_name ? "template" : "text");
  if (!to) return json({ error: "Informe o número em 'to'" }, 400);
  if (type === "text" && !body.text) return json({ error: "Informe 'text'" }, 400);
  if (type === "template" && !body.template_name) return json({ error: "Informe 'template_name'" }, 400);
  if (type !== "text" && type !== "template") return json({ error: "type deve ser 'text' ou 'template'" }, 400);

  const { data: integration } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("tenant_id", tenantId)
    .eq("provider", PROVIDER)
    .eq("is_active", true)
    .maybeSingle();
  const creds = (integration?.credentials || {}) as Record<string, string>;
  if (!creds.phone_number_id || !creds.api_token) {
    return json({ error: "WhatsApp (Datafy) não configurado" }, 400);
  }

  const payload: Record<string, unknown> = { messaging_product: "whatsapp", to };
  let storedText: string;
  if (type === "text") {
    payload.type = "text";
    payload.text = { body: String(body.text) };
    storedText = String(body.text);
  } else {
    const variables: string[] = Array.isArray(body.variables) ? body.variables : [];
    payload.type = "template";
    payload.template = {
      name: body.template_name,
      language: { code: body.template_language || "pt_BR" },
      components: variables.length > 0
        ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: String(v) })) }]
        : undefined,
    };
    storedText = `[Template: ${body.template_name}]`;
  }

  const apiRes = await fetch(`${DATAFY_API_URL}/${creds.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.api_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const apiData = await apiRes.json().catch(() => ({}));

  if (!apiRes.ok) {
    // Datafy errors: { statusCode, message } (401 token, 402 subscription, 403 blocked,
    // 409 paused channel, 429 rate limit). Meta errors are passed through as { error: {...} }.
    console.error("Datafy API error:", apiRes.status, apiData);
    const message = apiData?.error?.message || apiData?.message || "Erro ao enviar mensagem";
    return json({ error: message, details: apiData }, apiRes.status === 429 ? 429 : 502);
  }

  const wamid = apiData?.messages?.[0]?.id || null;

  const { error: insertError } = await supabase.from("messages").insert({
    tenant_id: tenantId,
    contact_phone: to,
    contact_name: body.contact_name || null,
    message_text: storedText,
    from_me: true,
    status: "sent",
    z_api_message_id: wamid,
    is_group: false,
  });
  if (insertError) console.error("Error storing outbound message:", insertError);

  return json({ ok: true, message_id: wamid });
}
