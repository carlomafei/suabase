import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { tenant_id, contact_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch contact purchase history
    let contactFilter = contact_id
      ? supabase.from("orders").select("*, contacts(name, tags)").eq("tenant_id", tenant_id).eq("contact_id", contact_id).order("order_date", { ascending: false }).limit(20)
      : supabase.from("orders").select("*, contacts(name, tags)").eq("tenant_id", tenant_id).order("order_date", { ascending: false }).limit(100);

    const { data: orders } = await contactFilter;

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ recommendations: [], message: "Sem histórico de pedidos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for AI
    const orderSummary = orders.map((o: any) => ({
      value: o.total_value,
      date: o.order_date,
      status: o.status,
      items: o.items,
      marketplace: o.marketplace,
      contact: o.contacts?.name,
    }));

    const prompt = `Você é um assistente de vendas especializado em cross-sell e upsell para e-commerce.

Analise o histórico de compras abaixo e gere recomendações de cross-sell e upsell.

Histórico de pedidos:
${JSON.stringify(orderSummary, null, 2)}

Para cada recomendação, retorne um JSON array com objetos contendo:
- type: "cross_sell" ou "upsell"
- title: título curto da recomendação
- description: por que essa recomendação faz sentido
- confidence: número de 0 a 1 indicando confiança
- target_contact: nome do contato alvo (se aplicável)

Retorne APENAS o JSON array, sem markdown ou texto adicional.`;

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("AI gateway error:", err);
      return new Response(
        JSON.stringify({ error: "Erro na análise de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let recommendations: any[];
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      recommendations = JSON.parse(cleaned);
    } catch {
      recommendations = [];
    }

    // Store recommendations in DB
    const inserts = recommendations.map((r: any) => ({
      tenant_id,
      contact_id: contact_id || null,
      type: r.type || "cross_sell",
      title: r.title,
      description: r.description,
      confidence: Math.min(1, Math.max(0, r.confidence || 0.5)),
      metadata: { target_contact: r.target_contact } as any,
      status: "pending",
    }));

    if (inserts.length > 0) {
      await supabase.from("ai_recommendations").insert(inserts);
    }

    return new Response(
      JSON.stringify({ success: true, recommendations: inserts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-recommendations error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
