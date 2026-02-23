
-- Convert role column from enum to text to avoid enum transaction issues
ALTER TABLE public.tenant_users 
  ALTER COLUMN role TYPE text USING role::text;

ALTER TABLE public.tenant_users
  ALTER COLUMN role SET DEFAULT 'member';

-- Drop the old enum type
DROP TYPE IF EXISTS public.tenant_role CASCADE;

-- Create validation trigger for role values
CREATE OR REPLACE FUNCTION public.validate_tenant_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.role NOT IN ('owner', 'admin', 'supervisor', 'member', 'atendente', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be one of: owner, admin, supervisor, member, atendente, viewer', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_role_before_insert_update
  BEFORE INSERT OR UPDATE ON public.tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tenant_role();

-- Role level helper function (using text now)
CREATE OR REPLACE FUNCTION public.role_level(_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
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

-- Update has_tenant_role to use text
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role AND is_active = true
  );
$$;

-- Hierarchy check: user has role >= min_role
CREATE OR REPLACE FUNCTION public.has_tenant_role_or_above(_user_id uuid, _tenant_id uuid, _min_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND is_active = true
      AND public.role_level(role) >= public.role_level(_min_role)
  );
$$;

-- Update RLS on automations: only admin+ can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Tenant automations insert" ON public.automations;
DROP POLICY IF EXISTS "Tenant automations update" ON public.automations;
DROP POLICY IF EXISTS "Tenant automations delete" ON public.automations;

CREATE POLICY "Tenant automations insert" ON public.automations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant automations update" ON public.automations
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant automations delete" ON public.automations
  FOR DELETE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

-- Messages: atendente+ can insert
DROP POLICY IF EXISTS "Tenant messages insert" ON public.messages;
CREATE POLICY "Tenant messages insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'atendente'));

-- Contacts: member+ can write, admin+ can delete
DROP POLICY IF EXISTS "Tenant contacts insert" ON public.contacts;
DROP POLICY IF EXISTS "Tenant contacts update" ON public.contacts;
DROP POLICY IF EXISTS "Tenant contacts delete" ON public.contacts;

CREATE POLICY "Tenant contacts insert" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));

CREATE POLICY "Tenant contacts update" ON public.contacts
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));

CREATE POLICY "Tenant contacts delete" ON public.contacts
  FOR DELETE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

-- CRM deals: member+ can write, admin+ can delete
DROP POLICY IF EXISTS "Tenant deals insert" ON public.crm_deals;
DROP POLICY IF EXISTS "Tenant deals update" ON public.crm_deals;
DROP POLICY IF EXISTS "Tenant deals delete" ON public.crm_deals;

CREATE POLICY "Tenant deals insert" ON public.crm_deals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));

CREATE POLICY "Tenant deals update" ON public.crm_deals
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'member'));

CREATE POLICY "Tenant deals delete" ON public.crm_deals
  FOR DELETE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

-- Tenant integrations: admin+ can manage
DROP POLICY IF EXISTS "Tenant integrations select" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Tenant integrations insert" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Tenant integrations update" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Tenant integrations delete" ON public.tenant_integrations;

CREATE POLICY "Tenant integrations select" ON public.tenant_integrations
  FOR SELECT TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant integrations insert" ON public.tenant_integrations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant integrations update" ON public.tenant_integrations
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant integrations delete" ON public.tenant_integrations
  FOR DELETE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'owner'));

-- Tenant_users: admin+ can manage team
DROP POLICY IF EXISTS "Tenant users select" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant users insert" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant users update" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant users delete" ON public.tenant_users;

CREATE POLICY "Tenant users select" ON public.tenant_users
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users insert" ON public.tenant_users
  FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant users update" ON public.tenant_users
  FOR UPDATE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'admin'));

CREATE POLICY "Tenant users delete" ON public.tenant_users
  FOR DELETE TO authenticated
  USING (public.has_tenant_role_or_above(auth.uid(), tenant_id, 'owner'));
