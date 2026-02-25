import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { code, tenant_id } = await req.json();

    if (!code || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "code e tenant_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing integration to read client_id and client_secret
    const { data: integration, error: intError } = await supabase
      .from("tenant_integrations")
      .select("id, credentials")
      .eq("tenant_id", tenant_id)
      .eq("provider", "bling")
      .single();

    if (intError || !integration?.credentials) {
      return new Response(
        JSON.stringify({ error: "Integração Bling não encontrada. Configure client_id e client_secret primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creds = integration.credentials as Record<string, string>;
    const clientId = creds.client_id;
    const clientSecret = creds.client_secret;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "client_id e client_secret não configurados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch(BLING_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Bling token exchange failed:", tokenRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "Falha ao obter tokens do Bling", details: errBody }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Save tokens to credentials
    const updatedCreds = {
      ...creds,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
    };

    const { error: updateError } = await supabase
      .from("tenant_integrations")
      .update({
        credentials: updatedCreds as any,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    if (updateError) {
      console.error("Failed to save tokens:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, expires_at: expiresAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("bling-oauth-callback error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
