import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";

export type IntegrationProvider = "bling" | "tiny" | "data_broker" | "whatsapp_meta";

export type IntegrationCategory = "erp" | "data_broker" | "whatsapp";

export interface Integration {
  id: string;
  provider: string;
  is_active: boolean;
  credentials: Record<string, string> | null;
  settings: Record<string, any> | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfig {
  id: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  description: string;
  available: boolean;
  credentialFields: { key: string; label: string; type: "text" | "password"; placeholder: string }[];
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "bling",
    name: "Bling ERP",
    category: "erp",
    description: "Sincronize pedidos, produtos e clientes do Bling.",
    available: true,
    credentialFields: [
      { key: "api_key", label: "API Key", type: "password", placeholder: "Cole sua API key do Bling" },
      { key: "client_id", label: "Client ID", type: "text", placeholder: "Client ID do app Bling" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "Client Secret" },
    ],
  },
  {
    id: "tiny",
    name: "Tiny ERP",
    category: "erp",
    description: "Sincronize pedidos e produtos do Tiny.",
    available: false,
    credentialFields: [
      { key: "token", label: "Token", type: "password", placeholder: "Token da API Tiny" },
    ],
  },
  {
    id: "data_broker",
    name: "Data Broker",
    category: "data_broker",
    description: "Enriqueça dados de contatos via provedores de dados.",
    available: true,
    credentialFields: [
      { key: "api_url", label: "URL da API", type: "text", placeholder: "https://api.exemplo.com" },
      { key: "api_key", label: "API Key", type: "password", placeholder: "Chave de acesso da API" },
    ],
  },
  {
    id: "whatsapp_meta",
    name: "WhatsApp (Meta Cloud API)",
    category: "whatsapp",
    description: "Envie e receba mensagens via WhatsApp Business API.",
    available: true,
    credentialFields: [
      { key: "phone_number_id", label: "Phone Number ID", type: "text", placeholder: "ID do número no Meta" },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "Token permanente do Meta" },
      { key: "webhook_verify_token", label: "Webhook Verify Token", type: "text", placeholder: "Token de verificação" },
      { key: "waba_id", label: "WABA ID", type: "text", placeholder: "WhatsApp Business Account ID" },
    ],
  },
];

export const useIntegrations = () => {
  const { tenantId } = useTenant();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }

    const { data } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenantId);

    setIntegrations((data || []) as Integration[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const getIntegration = (provider: string): Integration | undefined =>
    integrations.find((i) => i.provider === provider);

  const saveCredentials = async (
    provider: string,
    credentials: Record<string, string>,
    settings?: Record<string, any>
  ): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);

    const existing = getIntegration(provider);

    if (existing) {
      const { error } = await supabase
        .from("tenant_integrations")
        .update({
          credentials: credentials as any,
          settings: (settings || existing.settings || {}) as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      setSaving(false);
      if (!error) { await fetchIntegrations(); return true; }
      return false;
    }

    const { error } = await supabase
      .from("tenant_integrations")
      .insert({
        tenant_id: tenantId,
        provider,
        credentials: credentials as any,
        settings: (settings || {}) as any,
        is_active: true,
      });

    setSaving(false);
    if (!error) { await fetchIntegrations(); return true; }
    return false;
  };

  const toggleActive = async (provider: string): Promise<boolean> => {
    const existing = getIntegration(provider);
    if (!existing) return false;
    setSaving(true);

    const { error } = await supabase
      .from("tenant_integrations")
      .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    setSaving(false);
    if (!error) { await fetchIntegrations(); return true; }
    return false;
  };

  const removeIntegration = async (provider: string): Promise<boolean> => {
    const existing = getIntegration(provider);
    if (!existing) return false;
    setSaving(true);

    const { error } = await supabase
      .from("tenant_integrations")
      .delete()
      .eq("id", existing.id);

    setSaving(false);
    if (!error) { await fetchIntegrations(); return true; }
    return false;
  };

  return {
    integrations,
    loading,
    saving,
    getIntegration,
    saveCredentials,
    toggleActive,
    removeIntegration,
    refetch: fetchIntegrations,
  };
};
