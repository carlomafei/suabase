import { useEffect, useState } from "react";
import { Building2, Database, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
}

interface DataBrokerConfig {
  provider_type: string;
  api_url: string;
  api_key: string;
  username: string;
  password: string;
}

const isDeskdata = (providerType: string) => providerType === "deskdata";

const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [dbConfig, setDbConfig] = useState<DataBrokerConfig>({ provider_type: "", api_url: "", api_key: "", username: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [existingIntegrationId, setExistingIntegrationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await supabase.functions.invoke("admin-api", {
        body: { action: "list_tenants" },
      });
      setTenants(res.data?.tenants || []);
      setLoading(false);
    };
    fetchTenants();
  }, []);

  const openDataBrokerDialog = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowSecret(false);
    setLoadingConfig(true);
    setExistingIntegrationId(null);
    setDbConfig({ provider_type: "", api_url: "", api_key: "", username: "", password: "" });

    // Try to load existing deskdata integration first, then fall back to data_broker
    const { data: integrations } = await supabase
      .from("tenant_integrations")
      .select("id, provider, credentials, settings")
      .eq("tenant_id", tenant.id)
      .in("provider", ["deskdata", "data_broker"]);

    const integration = integrations?.find(i => i.provider === "deskdata") || integrations?.find(i => i.provider === "data_broker");

    if (integration) {
      const creds = (integration.credentials || {}) as Record<string, string>;
      const settings = (integration.settings || {}) as Record<string, string>;
      setExistingIntegrationId(integration.id);

      if (integration.provider === "deskdata") {
        setDbConfig({
          provider_type: "deskdata",
          api_url: "",
          api_key: "",
          username: creds.username || "",
          password: creds.password || "",
        });
      } else {
        setDbConfig({
          provider_type: settings.provider_type || "",
          api_url: creds.api_url || "",
          api_key: creds.api_key || "",
          username: "",
          password: "",
        });
      }
    }
    setLoadingConfig(false);
  };

  const handleSave = async () => {
    if (!selectedTenant) return;

    const isDesk = isDeskdata(dbConfig.provider_type);

    if (isDesk) {
      if (!dbConfig.username || !dbConfig.password) {
        toast.error("Preencha todos os campos");
        return;
      }
    } else {
      if (!dbConfig.provider_type || !dbConfig.api_url || !dbConfig.api_key) {
        toast.error("Preencha todos os campos");
        return;
      }
    }

    setSaving(true);
    try {
      const provider = isDesk ? "deskdata" : "data_broker";
      const credentials = isDesk
        ? { username: dbConfig.username, password: dbConfig.password }
        : { api_url: dbConfig.api_url, api_key: dbConfig.api_key };
      const settings = isDesk
        ? { provider_type: "deskdata" }
        : { provider_type: dbConfig.provider_type };

      if (existingIntegrationId) {
        await supabase
          .from("tenant_integrations")
          .update({ provider, credentials, settings, is_active: true })
          .eq("id", existingIntegrationId);
      } else {
        await supabase
          .from("tenant_integrations")
          .insert({
            tenant_id: selectedTenant.id,
            provider,
            credentials,
            settings,
            is_active: true,
          });
      }

      toast.success(`Data Broker configurado para ${selectedTenant.name}`);
      setSelectedTenant(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground mt-1">Gerencie todas as empresas da plataforma</p>
        </div>
      </div>

      {tenants.length === 0 ? (
        <Card className="border-border/50 p-8 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum tenant encontrado.</p>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-xs">Empresa</TableHead>
                  <TableHead className="text-xs">Slug</TableHead>
                  <TableHead className="text-xs">Plano</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id} className="border-border/50">
                    <TableCell className="text-sm font-medium">{t.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{t.slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{t.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                        {t.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => openDataBrokerDialog(t)}
                      >
                        <Database className="h-3 w-3" />
                        Data Broker
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Data Broker Config Dialog */}
      <Dialog open={!!selectedTenant} onOpenChange={(open) => !open && setSelectedTenant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Data Broker — {selectedTenant?.name}</DialogTitle>
            <DialogDescription>Configure o provedor de enriquecimento de dados para este tenant.</DialogDescription>
          </DialogHeader>

          {loadingConfig ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Provedor</Label>
                <Select
                  value={dbConfig.provider_type}
                  onValueChange={(v) => setDbConfig((p) => ({
                    ...p,
                    provider_type: v,
                    // Reset fields when switching provider type
                    api_url: isDeskdata(v) ? "" : p.api_url,
                    api_key: isDeskdata(v) ? "" : p.api_key,
                    username: isDeskdata(v) ? p.username : "",
                    password: isDeskdata(v) ? p.password : "",
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deskdata">Deskdata</SelectItem>
                    <SelectItem value="neoway">Neoway</SelectItem>
                    <SelectItem value="assertiva">Assertiva</SelectItem>
                    <SelectItem value="bigdatacorp">BigDataCorp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isDeskdata(dbConfig.provider_type) ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Username</Label>
                    <Input
                      placeholder="Usuário da API Deskdata"
                      value={dbConfig.username}
                      onChange={(e) => setDbConfig((p) => ({ ...p, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Input
                        type={showSecret ? "text" : "password"}
                        placeholder="Senha da API Deskdata"
                        value={dbConfig.password}
                        onChange={(e) => setDbConfig((p) => ({ ...p, password: e.target.value }))}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">API URL</Label>
                    <Input
                      placeholder="https://api.provedor.com/v1"
                      value={dbConfig.api_url}
                      onChange={(e) => setDbConfig((p) => ({ ...p, api_url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">API Key</Label>
                    <div className="relative">
                      <Input
                        type={showSecret ? "text" : "password"}
                        placeholder="Chave de acesso da API"
                        value={dbConfig.api_key}
                        onChange={(e) => setDbConfig((p) => ({ ...p, api_key: e.target.value }))}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTenant(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || loadingConfig}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTenants;
