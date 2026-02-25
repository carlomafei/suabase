CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_external_id
ON contacts (tenant_id, external_id)
WHERE external_id IS NOT NULL;