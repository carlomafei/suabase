import { useEffect, useState, useRef } from "react";
import { useBranding, type BrandingSettings } from "@/hooks/useBranding";
import { useTenant } from "@/hooks/useTenant";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Palette, Type, Image, Globe, FileText, Eye, Lock, Upload, Trash2, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { label: "Verde", value: "152 76% 46%" },
  { label: "Azul", value: "217 91% 60%" },
  { label: "Roxo", value: "271 76% 53%" },
  { label: "Rosa", value: "330 81% 60%" },
  { label: "Laranja", value: "25 95% 53%" },
  { label: "Vermelho", value: "0 84% 60%" },
];

function hslToHex(hslStr: string): string {
  const match = hslStr.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return "#22c55e";
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "152 76% 46%";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const BrandingSettings = () => {
  const { branding, loading, saveBranding } = useBranding();
  const { role, tenantId } = useTenant();
  const { currentPlan } = usePlan();
  const [form, setForm] = useState<BrandingSettings>(branding);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStarterOrFree = false;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  useEffect(() => {
    setForm(branding);
  }, [branding]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveBranding(form);
    setSaving(false);
    if (ok) toast.success("Branding salvo com sucesso!");
    else toast.error("Erro ao salvar branding.");
  };


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${tenantId}/logo.${ext}`;

    setUploading(true);
    const { error } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error("Erro ao fazer upload da logo.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    const urlWithCacheBust = `${urlData.publicUrl}?t=${Date.now()}`;
    const updatedForm = { ...form, logo_url: urlWithCacheBust };
    setForm(updatedForm);
    setUploading(false);

    const ok = await saveBranding(updatedForm);
    if (ok) toast.success("Logo enviada e salva com sucesso!");
    else toast.error("Logo enviada, mas erro ao salvar no banco.");

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLogoRemove = async () => {
    if (!tenantId) return;

    const { error } = await supabase.storage
      .from("logos")
      .remove([`${tenantId}/logo.png`, `${tenantId}/logo.jpg`, `${tenantId}/logo.jpeg`, `${tenantId}/logo.svg`, `${tenantId}/logo.webp`]);

    if (error) {
      toast.error("Erro ao remover logo.");
      return;
    }

    const updatedForm = { ...form, logo_url: "" };
    setForm(updatedForm);

    const ok = await saveBranding(updatedForm);
    if (ok) toast.success("Logo removida com sucesso!");
    else toast.error("Erro ao salvar remoção da logo.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Branding</h1>
      <p className="text-muted-foreground mb-8">
        Personalize a aparência da plataforma para sua empresa
      </p>

      <div className="space-y-8">
        {/* Logo */}
        <section className={cn("card-gradient rounded-xl border border-border/50 p-6 space-y-4 relative", isStarterOrFree && "opacity-60 pointer-events-none")}>
          {isStarterOrFree && (
            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl bg-background/50 backdrop-blur-[1px]">
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1.5">
                <Lock className="h-3.5 w-3.5" />
                Disponível em planos superiores
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Image className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Logo</h2>
          </div>
          <div className="space-y-3">
            <Label>Logo da empresa</Label>
            {form.logo_url && (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-muted/30">
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="h-12 max-w-[200px] object-contain"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogoRemove}
                  disabled={!isOwnerOrAdmin || isStarterOrFree}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={!isOwnerOrAdmin || isStarterOrFree || uploading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isOwnerOrAdmin || isStarterOrFree || uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Enviando..." : "Enviar logo"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tamanho ideal: 200×60px. Formatos aceitos: PNG, SVG, JPG ou WebP. Máximo 2MB. Fundo transparente recomendado.
            </p>
          </div>
        </section>

        {/* Colors */}
        <section className={cn("card-gradient rounded-xl border border-border/50 p-6 space-y-6 relative", isStarterOrFree && "opacity-60 pointer-events-none")}>
          {isStarterOrFree && (
            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl bg-background/50 backdrop-blur-[1px]">
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1.5">
                <Lock className="h-3.5 w-3.5" />
                Disponível em planos superiores
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Cores</h2>
          </div>

          {/* Primary */}
          <div className="space-y-3">
            <Label>Cor Primária</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => isOwnerOrAdmin && setForm({ ...form, primary_color: preset.value })}
                  className="group relative h-10 w-10 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: `hsl(${preset.value})`,
                    borderColor: form.primary_color === preset.value ? "hsl(var(--foreground))" : "transparent",
                  }}
                  title={preset.label}
                  disabled={!isOwnerOrAdmin}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="color"
                  value={hslToHex(form.primary_color)}
                  onChange={(e) => isOwnerOrAdmin && setForm({ ...form, primary_color: hexToHsl(e.target.value) })}
                  className="h-10 w-10 rounded-full border-0 cursor-pointer bg-transparent"
                  disabled={!isOwnerOrAdmin}
                />
                <span className="text-xs text-muted-foreground">Customizada</span>
              </div>
            </div>
            <div
              className="h-2 rounded-full mt-1"
              style={{ backgroundColor: `hsl(${form.primary_color})` }}
            />
          </div>

          <Separator />

          {/* Secondary */}
          <div className="space-y-3">
            <Label>Cor Secundária</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={hslToHex(form.secondary_color)}
                onChange={(e) => isOwnerOrAdmin && setForm({ ...form, secondary_color: hexToHsl(e.target.value) })}
                className="h-10 w-10 rounded-full border-0 cursor-pointer bg-transparent"
                disabled={!isOwnerOrAdmin}
              />
              <span className="text-sm text-muted-foreground">
                Usada em fundos e elementos secundários
              </span>
            </div>
            <div
              className="h-2 rounded-full mt-1"
              style={{ backgroundColor: `hsl(${form.secondary_color})` }}
            />
          </div>
        </section>

        {/* Theme Mode */}
        <section className="card-gradient rounded-xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Tema</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Escolha entre o tema escuro ou claro para a interface
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => isOwnerOrAdmin && setForm({ ...form, theme_mode: "dark" })}
              disabled={!isOwnerOrAdmin}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                form.theme_mode === "dark"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              )}
            >
              <div className="h-16 w-full rounded-lg bg-[hsl(220,20%,4%)] border border-[hsl(220,14%,14%)] flex items-center justify-center">
                <Moon className="h-6 w-6 text-[hsl(0,0%,95%)]" />
              </div>
              <span className="text-sm font-medium">Dark</span>
            </button>
            <button
              onClick={() => isOwnerOrAdmin && setForm({ ...form, theme_mode: "light" })}
              disabled={!isOwnerOrAdmin}
              className={cn(
                "flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
                form.theme_mode === "light"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              )}
            >
              <div className="h-16 w-full rounded-lg bg-white border border-[hsl(220,14%,90%)] flex items-center justify-center">
                <Sun className="h-6 w-6 text-[hsl(220,20%,10%)]" />
              </div>
              <span className="text-sm font-medium">Light</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <section className="card-gradient rounded-xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Rodapé</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="footer_text">Texto customizado do rodapé</Label>
            <Input
              id="footer_text"
              value={form.footer_text}
              onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
              placeholder="© 2026 Minha Empresa. Todos os direitos reservados."
              disabled={!isOwnerOrAdmin}
            />
          </div>
        </section>

        {/* Platform Branding */}
        <section className={cn("card-gradient rounded-xl border border-border/50 p-6 space-y-4 relative", isStarterOrFree && "opacity-60 pointer-events-none")}>
          {isStarterOrFree && (
            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl bg-background/50 backdrop-blur-[1px]">
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1.5">
                <Lock className="h-3.5 w-3.5" />
                Disponível em planos superiores
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Marca da Plataforma</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ocultar marca "Taqt"</p>
              <p className="text-xs text-muted-foreground">
                Remove referências à plataforma original (disponível em planos avançados)
              </p>
            </div>
            <Switch
              checked={form.hide_platform_branding}
              onCheckedChange={(checked) => setForm({ ...form, hide_platform_branding: checked })}
              disabled={!isOwnerOrAdmin || isStarterOrFree}
            />
          </div>
        </section>

        {/* Custom Domain (future) */}
        <section className={cn("card-gradient rounded-xl border border-border/50 p-6 space-y-4 relative", isStarterOrFree && "opacity-60 pointer-events-none")}>
          {isStarterOrFree && (
            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl bg-background/50 backdrop-blur-[1px]">
              <Badge variant="outline" className="gap-1.5 text-xs px-3 py-1.5">
                <Lock className="h-3.5 w-3.5" />
                Disponível em planos superiores
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Domínio Customizado</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_domain">Domínio personalizado</Label>
            <Input
              id="custom_domain"
              value={form.custom_domain}
              onChange={(e) => setForm({ ...form, custom_domain: e.target.value })}
              placeholder="app.suaempresa.com.br"
              disabled={!isOwnerOrAdmin || isStarterOrFree}
            />
            <p className="text-xs text-muted-foreground">
              Em breve: configure um domínio customizado para seus clientes acessarem.
            </p>
          </div>
        </section>

        {/* Save */}
        {isOwnerOrAdmin && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandingSettings;
