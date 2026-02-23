
-- 1. Add quality_score and opt-out fields to contacts
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opt_out_whatsapp boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_out_email boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS opt_out_sms boolean DEFAULT false;

-- 2. CPF normalization function (strips dots, dashes, slashes)
CREATE OR REPLACE FUNCTION public.normalize_cpf_cnpj()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cpf_cnpj IS NOT NULL THEN
    NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj, '[^0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_normalize_cpf_cnpj
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_cpf_cnpj();

-- 3. Contact quality score calculation function
CREATE OR REPLACE FUNCTION public.calculate_contact_quality_score()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_calculate_quality_score
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_contact_quality_score();

-- 4. Idempotency index for Bling orders (external_id uniqueness per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_external_id 
  ON public.orders(tenant_id, external_id) 
  WHERE external_id IS NOT NULL;

-- 5. Deduplication index for contacts by CPF/CNPJ per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_cpf_cnpj 
  ON public.contacts(tenant_id, cpf_cnpj) 
  WHERE cpf_cnpj IS NOT NULL;

-- 6. Add last_bling_sync_at to tenant_integrations for incremental sync
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS sync_cursor text DEFAULT null;

-- 7. Function to check WhatsApp 24h window
CREATE OR REPLACE FUNCTION public.check_whatsapp_24h_window(_contact_id uuid, _tenant_id uuid)
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SET search_path = public;

-- 8. Update existing contacts quality scores
UPDATE public.contacts SET updated_at = now();
