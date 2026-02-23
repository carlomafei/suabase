
-- ═══════════════════════════════════════════
-- 1. JOB QUEUE (substitui Redis + BullMQ)
-- ═══════════════════════════════════════════
CREATE TABLE public.job_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  queue text NOT NULL DEFAULT 'default',
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on job_queue"
  ON public.job_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for worker polling
CREATE INDEX idx_job_queue_pending ON public.job_queue(queue, status, priority DESC, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_job_queue_tenant ON public.job_queue(tenant_id, status);

-- ═══════════════════════════════════════════
-- 2. RATE LIMITING PER TENANT
-- ═══════════════════════════════════════════
CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  max_requests integer NOT NULL DEFAULT 100,
  UNIQUE(tenant_id, action, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on rate_limits"
  ON public.rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _tenant_id uuid,
  _action text,
  _max_requests integer DEFAULT 100,
  _window_seconds integer DEFAULT 3600
)
RETURNS boolean AS $$
DECLARE
  current_window timestamptz;
  current_count integer;
BEGIN
  current_window := date_trunc('hour', now());
  
  INSERT INTO public.rate_limits (tenant_id, action, window_start, request_count, max_requests)
  VALUES (_tenant_id, _action, current_window, 1, _max_requests)
  ON CONFLICT (tenant_id, action, window_start) 
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO current_count;
  
  RETURN current_count <= _max_requests;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ═══════════════════════════════════════════
-- 3. WEBHOOK DISPATCH
-- ═══════════════════════════════════════════
CREATE TABLE public.webhook_endpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage webhooks"
  ON public.webhook_endpoints FOR ALL
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  response_status integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Service role manages webhook deliveries"
  ON public.webhook_deliveries FOR ALL
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════
-- 4. AI RECOMMENDATIONS (Cross-sell & Upsell)
-- ═══════════════════════════════════════════
CREATE TABLE public.ai_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'cross_sell',
  title text NOT NULL,
  description text,
  confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  metadata jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view recommendations"
  ON public.ai_recommendations FOR ALL
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

-- ═══════════════════════════════════════════
-- 5. TRIGGER: auto update timestamps
-- ═══════════════════════════════════════════
CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_webhook_endpoints_updated_at BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
