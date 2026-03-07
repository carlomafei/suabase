
CREATE OR REPLACE FUNCTION public.create_deal_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  novo_stage_id uuid;
  deal_title text;
  next_position integer;
BEGIN
  -- Find the "Novo" stage (position 0) from the default pipeline for this tenant
  SELECT s.id INTO novo_stage_id
  FROM public.crm_stages s
  JOIN public.crm_pipelines p ON s.pipeline_id = p.id
  WHERE p.tenant_id = NEW.tenant_id
    AND p.is_default = true
    AND s.position = 0
  LIMIT 1;

  -- If no stage found, skip
  IF novo_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build deal title from contact name or order external_id
  SELECT COALESCE(c.name, 'Pedido ' || COALESCE(NEW.external_id, NEW.id::text))
  INTO deal_title
  FROM public.contacts c
  WHERE c.id = NEW.contact_id;

  IF deal_title IS NULL THEN
    deal_title := 'Pedido ' || COALESCE(NEW.external_id, NEW.id::text);
  END IF;

  -- Get next position
  SELECT COALESCE(MAX(position), -1) + 1 INTO next_position
  FROM public.crm_deals
  WHERE stage_id = novo_stage_id AND tenant_id = NEW.tenant_id;

  -- Create the deal
  INSERT INTO public.crm_deals (tenant_id, stage_id, title, value, contact_id, position, metadata)
  VALUES (
    NEW.tenant_id,
    novo_stage_id,
    deal_title,
    NEW.total_value,
    NEW.contact_id,
    next_position,
    jsonb_build_object('order_id', NEW.id, 'external_id', NEW.external_id, 'marketplace', NEW.marketplace)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_deal_on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_on_new_order();
