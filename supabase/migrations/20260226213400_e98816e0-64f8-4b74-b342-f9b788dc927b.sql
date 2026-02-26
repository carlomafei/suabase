CREATE POLICY "Owners and admins can update tenant"
  ON public.tenants FOR UPDATE
  USING (has_tenant_role_or_above(auth.uid(), id, 'admin'))
  WITH CHECK (has_tenant_role_or_above(auth.uid(), id, 'admin'));