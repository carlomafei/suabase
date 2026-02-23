import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Job Worker — Polls job_queue and processes jobs
 * Replaces BullMQ workers with Postgres-based queue
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const queue = body.queue || "default";
    const batchSize = body.batch_size || 10;

    // Claim pending jobs (atomic update)
    const { data: jobs } = await supabase
      .from("job_queue")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: undefined, // will be incremented below
      })
      .eq("status", "pending")
      .eq("queue", queue)
      .lte("scheduled_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("scheduled_at", { ascending: true })
      .limit(batchSize)
      .select("*");

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        // Rate limit check
        const { data: allowed } = await supabase.rpc("check_rate_limit", {
          _tenant_id: job.tenant_id,
          _action: job.job_type,
          _max_requests: 1000,
          _window_seconds: 3600,
        });

        if (!allowed) {
          await supabase
            .from("job_queue")
            .update({
              status: "pending",
              scheduled_at: new Date(Date.now() + 60000).toISOString(),
              error: "Rate limited - rescheduled",
            })
            .eq("id", job.id);
          continue;
        }

        // Process job based on type
        const result = await processJob(supabase, job);

        await supabase
          .from("job_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            result: result as any,
            attempts: (job.attempts || 0) + 1,
          })
          .eq("id", job.id);

        // Dispatch webhook if applicable
        await dispatchWebhook(supabase, job.tenant_id, `job.${job.job_type}.completed`, {
          job_id: job.id,
          result,
        });

        processed++;
      } catch (err: any) {
        const attempts = (job.attempts || 0) + 1;
        const isFinal = attempts >= (job.max_attempts || 3);

        await supabase
          .from("job_queue")
          .update({
            status: isFinal ? "failed" : "pending",
            failed_at: isFinal ? new Date().toISOString() : null,
            error: err.message,
            attempts,
            scheduled_at: isFinal
              ? job.scheduled_at
              : new Date(Date.now() + Math.pow(2, attempts) * 1000).toISOString(),
          })
          .eq("id", job.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: jobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("worker error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processJob(supabase: any, job: any): Promise<any> {
  const { job_type, payload, tenant_id } = job;

  switch (job_type) {
    case "sync_bling": {
      // Trigger Bling sync edge function
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/bling-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id }),
        }
      );
      return await res.json();
    }

    case "enrich_contact": {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/data-broker`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id,
            contact_id: payload.contact_id,
            cpf: payload.cpf,
            nome: payload.nome,
          }),
        }
      );
      return await res.json();
    }

    case "send_whatsapp": {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenant_id,
            contact_id: payload.contact_id,
            template_name: payload.template_name,
            template_language: payload.template_language || "pt_BR",
            variables: payload.variables || [],
          }),
        }
      );
      return await res.json();
    }

    case "generate_recommendations": {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-recommendations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id, contact_id: payload.contact_id }),
        }
      );
      return await res.json();
    }

    default:
      return { message: `Unknown job type: ${job_type}` };
  }
}

async function dispatchWebhook(
  supabase: any,
  tenantId: string,
  event: string,
  payload: any
) {
  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("id, url, secret")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (!endpoints || endpoints.length === 0) return;

  for (const ep of endpoints) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (ep.secret) {
        headers["X-Webhook-Secret"] = ep.secret;
      }

      const res = await fetch(ep.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() }),
      });

      await supabase.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        tenant_id: tenantId,
        event,
        payload: payload as any,
        response_status: res.status,
        response_body: await res.text().catch(() => ""),
        status: res.ok ? "delivered" : "failed",
        attempts: 1,
        delivered_at: res.ok ? new Date().toISOString() : null,
      });
    } catch (err: any) {
      await supabase.from("webhook_deliveries").insert({
        endpoint_id: ep.id,
        tenant_id: tenantId,
        event,
        payload: payload as any,
        status: "failed",
        response_body: err.message,
        attempts: 1,
      });
    }
  }
}
