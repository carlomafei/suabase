import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);

  // ─── WEBHOOK VERIFICATION (GET) ───
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe") {
      // We need to check against any tenant's verify token
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

  // ─── WEBHOOK INCOMING (POST from Meta) ───
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Check if this is a webhook from Meta (no Authorization header)
      const authHeader = req.headers.get("Authorization");
      const isWebhook = !authHeader && body?.object === "whatsapp_business_account";

      if (isWebhook) {
        return await handleIncomingWebhook(supabase, body);
      }

      // ─── SEND TEMPLATE (POST from frontend) ───
      return await handleSendTemplate(supabase, req, body);
    } catch (err: any) {
      console.error("whatsapp error:", err);
      return new Response(
        JSON.stringify({ error: err.message || "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

// ─── HANDLE INCOMING WEBHOOK ───
async function handleIncomingWebhook(supabase: any, body: any) {
  const entries = body?.entry || [];

  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;

      // Find tenant by phone_number_id
      const { data: integration } = await supabase
        .from("tenant_integrations")
        .select("tenant_id, credentials")
        .eq("provider", "whatsapp_meta")
        .eq("is_active", true)
        .filter("credentials->phone_number_id", "eq", phoneNumberId)
        .maybeSingle();

      if (!integration) continue;

      const tenantId = integration.tenant_id;

      // Process messages
      const messages = value.messages || [];
      for (const msg of messages) {
        const fromPhone = msg.from;
        const providerMsgId = msg.id;
        const content = msg.text?.body || msg.type || "";

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
          metadata: { from: fromPhone, type: msg.type } as any,
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
          .eq("provider_message_id", providerMsgId);
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── HANDLE SEND TEMPLATE ───
async function handleSendTemplate(supabase: any, req: Request, body: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { tenant_id, contact_id, template_name, template_language, variables } = body;

  if (!tenant_id || !contact_id || !template_name) {
    return new Response(
      JSON.stringify({ error: "tenant_id, contact_id e template_name obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get WhatsApp credentials
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("credentials")
    .eq("tenant_id", tenant_id)
    .eq("provider", "whatsapp_meta")
    .eq("is_active", true)
    .single();

  if (!integration?.credentials) {
    return new Response(
      JSON.stringify({ error: "WhatsApp não configurado" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const creds = integration.credentials as Record<string, string>;

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
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check opt-out
  if (contact.opt_out_whatsapp) {
    return new Response(
      JSON.stringify({ error: "Contato fez opt-out de WhatsApp" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check 24h window for non-template messages
  // Templates can always be sent (they are pre-approved by Meta)

  // Build template components
  const components: any[] = [];
  if (variables && variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map((v: string) => ({ type: "text", text: v })),
    });
  }

  // Send via Meta Cloud API
  const metaRes = await fetch(
    `${META_GRAPH_URL}/${creds.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
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
    }
  );

  const metaData = await metaRes.json();

  if (!metaRes.ok) {
    console.error("Meta API error:", metaData);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar via Meta", details: metaData }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const providerMessageId = metaData.messages?.[0]?.id || null;

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
      template_name,
      template_language: template_language || "pt_BR",
      variables,
      meta_response: metaData,
    } as any,
  });

  return new Response(
    JSON.stringify({
      success: true,
      provider_message_id: providerMessageId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
