import { useState } from "react";
import { useIntegrations, PROVIDER_CONFIGS, type ProviderConfig, type IntegrationCategory } from "@/hooks/useIntegrations";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plug, ShoppingBag, Database, MessageCircle, Check, X, Loader2, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<IntegrationCategory, { label: string; icon: typeof Plug; description: string }> = {
  erp: { label: "ERP", icon: ShoppingBag, description: "Conecte seu sistema de gestão para sincronizar pedidos e produtos." },
  data_broker: { label: "Data Broker", icon: Database, description: "Enriqueça dados de contatos automaticamente." },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, description: "Configure o envio e recebimento de mensagens." },
};

const IntegrationSettings = () => {
  const { getIntegration, saveCredentials, toggleActive, removeIntegration, loading, saving } = useIntegrations();
  const { can } = usePermissions();
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const canManage = can("configure_integrations");

  const openConfig = (config: ProviderConfig) => {
    const existing = getIntegration(config.id);
    const creds = (existing?.credentials || {}) as Record<string, string>;
    const initial: Record<string, string> = {};
    config.credentialFields.forEach((f) => { initial[f.key] = creds[f.key] || ""; });
    setFormValues(initial);
    setShowPasswords({});
    setEditingProvider(config);
  };

  const handleSave = async () => {
    if (!editingProvider) return;
    const hasEmpty = editingProvider.credentialFields.some((f) => !formValues[f.key]?.trim());
    if (hasEmpty) { toast.error("Preencha todos os campos"); return; }

    const ok = await saveCredentials(editingProvider.id, formValues);
    if (ok) {
      toast.success(`${editingProvider.name} configurado com sucesso!`);
      setEditingProvider(null);
    } else {
      toast.error("Erro ao salvar credenciais");
    }
  };

  const handleToggle = async (provider: string, name: string) => {
    const ok = await toggleActive(provider);
    if (ok) toast.success(`${name} atualizado`);
    else toast.error("Erro ao atualizar integração");
  };

  const handleRemove = async (provider: string, name: string) => {
    const ok = await removeIntegration(provider);
    if (ok) toast.success(`${name} removido`);
    else toast.error("Erro ao remover integração");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories: IntegrationCategory[] = ["erp", "data_broker", "whatsapp"];

  return (
    <div className="space-y-8">
      {categories.map((cat) => {
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        const providers = PROVIDER_CONFIGS.filter((p) => p.category === cat);

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-lg">{meta.label}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{meta.description}</p>

            <div className="grid gap-4 md:grid-cols-2">
              {providers.map((config) => {
                const integration = getIntegration(config.id);
                const isConnected = !!integration;
                const isActive = integration?.is_active ?? false;

                return (
                  <Card key={config.id} className={cn("border-border/50 transition-colors", isConnected && isActive && "border-primary/30")}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{config.name}</CardTitle>
                          {!config.available && (
                            <Badge variant="secondary" className="text-xs">Em breve</Badge>
                          )}
                        </div>
                        {isConnected && (
                          <div className="flex items-center gap-2">
                            <Badge variant={isActive ? "default" : "secondary"} className={cn("text-xs", isActive ? "bg-primary/15 text-primary" : "")}>
                              {isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardDescription className="text-xs">{config.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {config.available && canManage ? (
                          <>
                            <Button
                              size="sm"
                              variant={isConnected ? "outline" : "default"}
                              onClick={() => openConfig(config)}
                              className="text-xs"
                            >
                              {isConnected ? "Editar" : "Configurar"}
                            </Button>
                            {isConnected && (
                              <>
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={() => handleToggle(config.id, config.name)}
                                  disabled={saving}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemove(config.id, config.name)}
                                  disabled={saving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        ) : !canManage ? (
                          <p className="text-xs text-muted-foreground">Sem permissão para configurar integrações.</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Disponível em breve.</p>
                        )}
                      </div>
                      {integration?.last_sync_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Última sincronia: {new Date(integration.last_sync_at).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Credential dialog */}
      <Dialog open={!!editingProvider} onOpenChange={(open) => !open && setEditingProvider(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingProvider?.name}</DialogTitle>
            <DialogDescription>{editingProvider?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editingProvider?.credentialFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs">{field.label}</Label>
                <div className="relative">
                  <Input
                    type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                    placeholder={field.placeholder}
                    value={formValues[field.key] || ""}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="pr-10"
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPasswords((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    >
                      {showPasswords[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProvider(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegrationSettings;
