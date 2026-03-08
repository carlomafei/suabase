-- =============================================
-- TAQT - Schema Completo para Supabase Externo
-- Gerado em: 2026-03-08
-- =============================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELAS

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Super Admins
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  plan text NOT NULL DEFAULT 'free',
  primary_color text DEFAULT '#22c55e',
  secondary_color text DEFAULT '#16a34a',
  custom_domain text,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant Users
CREATE TABLE public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  whatsapp text,
  cpf_cnpj text,
  external_id text,
  source text DEFAULT 'manual',
  tags text[] DEFAULT '{}'::text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  quality_score integer DEFAULT 0,
  enriched_at timestamptz,
  opt_out_whatsapp boolean DEFAULT false,
  opt_out_email boolean DEFAULT false,
  opt_out_sms boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CRM Pipelines
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CRM Stages
CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text DEFAULT '#22c55e',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CRM Deals
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  assigned_to uuid,
  title text NOT NULL,
  value numeric DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  external_id text,
  marketplace text,
  status text NOT NULL DEFAULT 'pending',
  total_value numeric NOT NULL DEFAULT 0,
  items jsonb DEFAULT '[]'::jsonb,
  order_date timestamptz,
  synced_from text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- WhatsApp Templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'marketing',
  variables text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  template_id uuid REFERENCES public.whatsapp_templates(id),
  channel text NOT NULL DEFAULT 'whatsapp',
  direction text NOT NULL DEFAULT 'outbound',
  content text,
  status text NOT NULL DEFAULT 'pending',
  sentiment text,
  provider_message_id text,
  sent_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Automations
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI Recommendations
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'cross_sell',
  confidence numeric NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant Integrations
CREATE TABLE public.tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  credentials jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_cursor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Usage Tracking
CREATE TABLE public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period text NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  limit_value integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Job Queue
CREATE TABLE public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  queue text NOT NULL DEFAULT 'default',
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rate Limits
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  max_requests integer NOT NULL DEFAULT 100,
  UNIQUE(tenant_id, action, window_start)
);

-- Webhook Endpoints
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}'::text[],
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Webhook Deliveries
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  response_status integer,
  response_body text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- 3. FUNÇÕES
-- =============================================

CREATE OR REPLACE FUNCTION public.role_level(_role text)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 6
    WHEN 'admin' THEN 5
    WHEN 'supervisor' THEN 4
    WHEN 'member' THEN 3
    WHEN 'atendente' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = _user_id AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role_or_above(_user_id uuid, _tenant_id uuid, _min_role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND is_active = true
      AND public.role_level(role) >= public.role_level(_min_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_tenant_role()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role NOT IN ('owner', 'admin', 'supervisor', 'member', 'atendente', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be one of: owner, admin, supervisor, member, atendente, viewer', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_cpf_cnpj()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cpf_cnpj IS NOT NULL THEN
    NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj, '[^0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_contact_quality_score()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  score integer := 0;
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN score := score + 20; END IF;
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN score := score + 20; END IF;
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN score := score + 15; END IF;
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp != '' THEN score := score + 15; END IF;
  IF NEW.cpf_cnpj IS NOT NULL AND NEW.cpf_cnpj != '' THEN score := score + 20; END IF;
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN score := score + 10; END IF;
  NEW.quality_score := score;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_whatsapp_24h_window(_contact_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  last_inbound timestamp with time zone;
BEGIN
  SELECT MAX(sent_at) INTO last_inbound
  FROM public.messages
  WHERE contact_id = _contact_id
    AND tenant_id = _tenant_id
    AND direction = 'inbound'
    AND channel = 'whatsapp';
  IF last_inbound IS NULL THEN RETURN false; END IF;
  RETURN (now() - last_inbound) < interval '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_tenant_id uuid, _action text, _max_requests integer DEFAULT 100, _window_seconds integer DEFAULT 3600)
RETURNS boolean LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_tenant_id uuid;
  starter_plan_id uuid;
  default_pipeline_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));

  INSERT INTO public.tenants (name, slug, plan)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Minha Empresa'),
    REPLACE(LOWER(COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'empresa-' || LEFT(NEW.id::text, 8))), ' ', '-'),
    'starter'
  ) RETURNING id INTO new_tenant_id;

  INSERT INTO public.tenant_users (tenant_id, user_id, role) VALUES (new_tenant_id, NEW.id, 'owner');

  INSERT INTO public.crm_pipelines (tenant_id, name, is_default)
  VALUES (new_tenant_id, 'Pipeline Principal', true) RETURNING id INTO default_pipeline_id;

  INSERT INTO public.crm_stages (tenant_id, pipeline_id, name, position, color) VALUES
    (new_tenant_id, default_pipeline_id, 'Novo', 0, '#6366f1'),
    (new_tenant_id, default_pipeline_id, 'Qualificado', 1, '#f59e0b'),
    (new_tenant_id, default_pipeline_id, 'Proposta', 2, '#3b82f6'),
    (new_tenant_id, default_pipeline_id, 'Negociação', 3, '#8b5cf6'),
    (new_tenant_id, default_pipeline_id, 'Fechado', 4, '#22c55e');

  SELECT id INTO starter_plan_id FROM public.plans WHERE slug = 'starter' LIMIT 1;
  IF starter_plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (tenant_id, plan_id, status, billing_cycle)
    VALUES (new_tenant_id, starter_plan_id, 'active', 'monthly');
  END IF;

  INSERT INTO public.usage_tracking (tenant_id, metric, period, current_value, limit_value) VALUES
    (new_tenant_id, 'contacts', TO_CHAR(now(), 'YYYY-MM'), 0, 500),
    (new_tenant_id, 'whatsapp_sends', TO_CHAR(now(), 'YYYY-MM'), 0, 1000),
    (new_tenant_id, 'users', TO_CHAR(now(), 'YYYY-MM'), 1, 2);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_deal_on_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  novo_stage_id uuid;
  deal_title text;
  next_position integer;
BEGIN
  SELECT s.id INTO novo_stage_id
  FROM public.crm_stages s
  JOIN public.crm_pipelines p ON s.pipeline_id = p.id
  WHERE p.tenant_id = NEW.tenant_id
    AND p.is_default = true
    AND s.position = 0
  LIMIT 1;

  IF novo_stage_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(c.name, 'Pedido ' || COALESCE(NEW.external_id, NEW.id::text))
  INTO deal_title
  FROM public.contacts c WHERE c.id = NEW.contact_id;

  IF deal_title IS NULL THEN
    deal_title := 'Pedido ' || COALESCE(NEW.external_id, NEW.id::text);
  END IF;

  SELECT COALESCE(MAX(position), -1) + 1 INTO next_position
  FROM public.crm_deals WHERE stage_id = novo_stage_id AND tenant_id = NEW.tenant_id;

  INSERT INTO public.crm_deals (tenant_id, stage_id, title, value, contact_id, position, metadata)
  VALUES (
    NEW.tenant_id, novo_stage_id, deal_title, NEW.total_value, NEW.contact_id, next_position,
    jsonb_build_object('order_id', NEW.id, 'external_id', NEW.external_id, 'marketplace', NEW.marketplace)
  );

  RETURN NEW;
END;
$$;

-- =============================================
-- 4. TRIGGERS
-- =============================================

-- Trigger: novo usuário → criar profile + tenant
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: validar role do tenant_users
CREATE TRIGGER validate_tenant_role_trigger
  BEFORE INSERT OR UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_role();

-- Trigger: normalizar CPF/CNPJ
CREATE TRIGGER normalize_cpf_cnpj_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_cpf_cnpj();

-- Trigger: calcular quality score do contato
CREATE TRIGGER calculate_quality_score_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.calculate_contact_quality_score();

-- Trigger: criar deal ao inserir order
CREATE TRIGGER create_deal_on_new_order_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_deal_on_new_order();

-- Triggers: updated_at automático
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crm_deals_updated_at BEFORE UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenant_integrations_updated_at BEFORE UPDATE ON public.tenant_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_webhook_endpoints_updated_at BEFORE UPDATE ON public.webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. HABILITAR RLS EM TODAS AS TABELAS
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. RLS POLICIES
-- =============================================

-- Profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Super Admins
CREATE POLICY "Users can check own super admin status" ON public.super_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role manages super admins" ON public.super_admins FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tenants
CREATE POLICY "Members view tenant" ON public.tenants FOR SELECT TO authenticated USING (id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Owners and admins can update tenant" ON public.tenants FOR UPDATE TO authenticated USING (has_tenant_role_or_above(auth.uid(), id, 'admin')) WITH CHECK (has_tenant_role_or_above(auth.uid(), id, 'admin'));

-- Tenant Users
CREATE POLICY "Members view tenant users" ON public.tenant_users FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users select" ON public.tenant_users FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users insert" ON public.tenant_users FOR INSERT TO authenticated WITH CHECK (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant users update" ON public.tenant_users FOR UPDATE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant users delete" ON public.tenant_users FOR DELETE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'owner'));

-- Plans
CREATE POLICY "Plans viewable by authenticated" ON public.plans FOR SELECT TO authenticated USING (true);

-- Subscriptions
CREATE POLICY "Tenant members can view subscription" ON public.subscriptions FOR SELECT TO authenticated USING (is_tenant_member(tenant_id, auth.uid()));

-- Contacts
CREATE POLICY "Tenant contacts select" ON public.contacts FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant contacts insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));
CREATE POLICY "Tenant contacts update" ON public.contacts FOR UPDATE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));
CREATE POLICY "Tenant contacts delete" ON public.contacts FOR DELETE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

-- CRM Pipelines
CREATE POLICY "Tenant pipelines select" ON public.crm_pipelines FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant pipelines insert" ON public.crm_pipelines FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant pipelines update" ON public.crm_pipelines FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant pipelines delete" ON public.crm_pipelines FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- CRM Stages
CREATE POLICY "Tenant stages select" ON public.crm_stages FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant stages insert" ON public.crm_stages FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant stages update" ON public.crm_stages FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant stages delete" ON public.crm_stages FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- CRM Deals
CREATE POLICY "Tenant deals select" ON public.crm_deals FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant deals insert" ON public.crm_deals FOR INSERT TO authenticated WITH CHECK (has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));
CREATE POLICY "Tenant deals update" ON public.crm_deals FOR UPDATE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));
CREATE POLICY "Tenant deals delete" ON public.crm_deals FOR DELETE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

-- Orders
CREATE POLICY "Tenant orders select" ON public.orders FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant orders update" ON public.orders FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant orders delete" ON public.orders FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- WhatsApp Templates
CREATE POLICY "Tenant templates select" ON public.whatsapp_templates FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant templates insert" ON public.whatsapp_templates FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant templates update" ON public.whatsapp_templates FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant templates delete" ON public.whatsapp_templates FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Messages
CREATE POLICY "Tenant messages select" ON public.messages FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant messages insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (has_tenant_role_or_above(auth.uid(), tenant_id, 'atendente'));

-- Automations
CREATE POLICY "Tenant automations select" ON public.automations FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant automations insert" ON public.automations FOR INSERT TO authenticated WITH CHECK (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant automations update" ON public.automations FOR UPDATE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant automations delete" ON public.automations FOR DELETE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

-- AI Recommendations
CREATE POLICY "Tenant members view recommendations" ON public.ai_recommendations FOR ALL TO authenticated USING (is_tenant_member(tenant_id, auth.uid())) WITH CHECK (is_tenant_member(tenant_id, auth.uid()));

-- Tenant Integrations
CREATE POLICY "Tenant integrations select" ON public.tenant_integrations FOR SELECT TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant integrations insert" ON public.tenant_integrations FOR INSERT TO authenticated WITH CHECK (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant integrations update" ON public.tenant_integrations FOR UPDATE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));
CREATE POLICY "Tenant integrations delete" ON public.tenant_integrations FOR DELETE TO authenticated USING (has_tenant_role_or_above(auth.uid(), tenant_id, 'owner'));

-- Usage Tracking
CREATE POLICY "Tenant members can view usage" ON public.usage_tracking FOR SELECT TO authenticated USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members can manage usage" ON public.usage_tracking FOR ALL TO authenticated USING (is_tenant_member(tenant_id, auth.uid())) WITH CHECK (is_tenant_member(tenant_id, auth.uid()));

-- Job Queue
CREATE POLICY "Authenticated users can view own tenant jobs" ON public.job_queue FOR SELECT TO authenticated USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Only service role inserts jobs" ON public.job_queue FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Only service role updates jobs" ON public.job_queue FOR UPDATE TO service_role USING (true);
CREATE POLICY "Only service role deletes jobs" ON public.job_queue FOR DELETE TO service_role USING (true);

-- Rate Limits
CREATE POLICY "Only service role manages rate_limits" ON public.rate_limits FOR SELECT TO service_role USING (true);
CREATE POLICY "Only service role inserts rate_limits" ON public.rate_limits FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Only service role updates rate_limits" ON public.rate_limits FOR UPDATE TO service_role USING (true);

-- Webhook Endpoints
CREATE POLICY "Tenant members manage webhooks" ON public.webhook_endpoints FOR ALL TO authenticated USING (is_tenant_member(tenant_id, auth.uid())) WITH CHECK (is_tenant_member(tenant_id, auth.uid()));

-- Webhook Deliveries
CREATE POLICY "Tenant members view webhook deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Service role inserts webhook deliveries" ON public.webhook_deliveries FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role updates webhook deliveries" ON public.webhook_deliveries FOR UPDATE TO service_role USING (true);

-- =============================================
-- 7. STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- =============================================
-- 8. DADOS INICIAIS (PLANS)
-- =============================================

-- Insira seus planos aqui, exemplo:
-- INSERT INTO public.plans (name, slug, price_monthly, features, limits) VALUES
--   ('Starter', 'starter', 0, '["CRM básico", "500 contatos"]', '{"contacts": 500, "whatsapp_sends": 1000, "users": 2}'),
--   ('Pro', 'pro', 99, '["CRM completo", "5000 contatos"]', '{"contacts": 5000, "whatsapp_sends": 10000, "users": 10}');
