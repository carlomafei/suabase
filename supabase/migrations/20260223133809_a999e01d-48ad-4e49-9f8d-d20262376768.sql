
-- Fix: Replace overly permissive policies on service-only tables
-- These tables are only accessed by edge functions using service_role key

-- job_queue: drop and recreate with proper auth check
DROP POLICY IF EXISTS "Service role full access on job_queue" ON public.job_queue;
CREATE POLICY "Authenticated users can view own tenant jobs"
  ON public.job_queue FOR SELECT
  USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Only service role inserts jobs"
  ON public.job_queue FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Only service role updates jobs"
  ON public.job_queue FOR UPDATE
  USING (auth.role() = 'service_role');
CREATE POLICY "Only service role deletes jobs"
  ON public.job_queue FOR DELETE
  USING (auth.role() = 'service_role');

-- rate_limits: same pattern
DROP POLICY IF EXISTS "Service role full access on rate_limits" ON public.rate_limits;
CREATE POLICY "Only service role manages rate_limits"
  ON public.rate_limits FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY "Only service role inserts rate_limits"
  ON public.rate_limits FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Only service role updates rate_limits"
  ON public.rate_limits FOR UPDATE
  USING (auth.role() = 'service_role');

-- webhook_deliveries: keep tenant read, restrict writes
DROP POLICY IF EXISTS "Service role manages webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Service role inserts webhook deliveries"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role updates webhook deliveries"
  ON public.webhook_deliveries FOR UPDATE
  USING (auth.role() = 'service_role');
