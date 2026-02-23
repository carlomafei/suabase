
-- Plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2),
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage tracking
CREATE TABLE public.usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  current_value INT NOT NULL DEFAULT 0,
  limit_value INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, metric, period)
);

-- RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans viewable by authenticated" ON public.plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tenant members can view subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant owner/admin can update subscription" ON public.subscriptions FOR UPDATE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'owner'::tenant_role) OR public.has_tenant_role(auth.uid(), tenant_id, 'admin'::tenant_role));

CREATE POLICY "Tenant members can view usage" ON public.usage_tracking FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can manage usage" ON public.usage_tracking FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

-- Seed plans
INSERT INTO public.plans (name, slug, description, price_monthly, price_yearly, sort_order, limits, features) VALUES
('Starter', 'starter', 'Para quem está começando.', 97, 970, 1,
 '{"max_contacts":500,"max_whatsapp_sends":1000,"max_users":2,"max_pipelines":1,"automations":false,"analytics_advanced":false,"white_label":false,"api_access":false}',
 '["Até 500 contatos","1.000 envios WhatsApp/mês","2 usuários","1 pipeline CRM","Suporte por email"]'),
('Growth', 'growth', 'Para empresas em crescimento.', 247, 2470, 2,
 '{"max_contacts":5000,"max_whatsapp_sends":10000,"max_users":10,"max_pipelines":5,"automations":true,"analytics_advanced":true,"white_label":false,"api_access":false}',
 '["Até 5.000 contatos","10.000 envios WhatsApp/mês","10 usuários","5 pipelines CRM","Automações","Analytics avançado","Suporte prioritário"]'),
('Scale', 'scale', 'Operação avançada com white-label.', 497, 4970, 3,
 '{"max_contacts":-1,"max_whatsapp_sends":-1,"max_users":-1,"max_pipelines":-1,"automations":true,"analytics_advanced":true,"white_label":true,"api_access":true}',
 '["Contatos ilimitados","Envios ilimitados","Usuários ilimitados","Pipelines ilimitados","White-label completo","API aberta","Suporte dedicado"]');

-- Update handle_new_user to assign starter plan
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
