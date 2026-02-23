-- Add missing columns to tenants table for full multi-tenant customization
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#22c55e',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#16a34a',
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
