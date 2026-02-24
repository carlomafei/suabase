import { useEffect, useState } from "react";
import { useBranding, type BrandingSettings } from "@/hooks/useBranding";
import { useTenant } from "@/hooks/useTenant";
import { usePlan } from "@/hooks/usePlan";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Palette, Type, Image, Globe, FileText, Eye, Lock } from "lucide-react";
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
  const { role } = useTenant();
  const { currentPlan } = usePlan();
  const [form, setForm] = useState<BrandingSettings>(branding);
  const [saving, setSaving] = useState(false);

  const isStarterOrFree = !currentPlan || ["starter", "free", "trial", "teste"].includes(currentPlan.slug?.toLowerCase() || "");
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
        {/* Platform Name */}
        <section className="card-gradient rounded-xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Type className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Nome da Plataforma</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform_name">Nome exibido na sidebar e rodapé</Label>
            <Input
              id="platform_name"
              value={form.platform_name}
              onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
              placeholder="Sua Base"
              disabled={!isOwnerOrAdmin}
            />
          </div>
        </section>

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
          <div className="space-y-2">
            <Label htmlFor="logo_url">URL do logo (PNG ou SVG recomendado)</Label>
            <Input
              id="logo_url"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://exemplo.com/logo.png"
              disabled={!isOwnerOrAdmin || isStarterOrFree}
            />
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
              <p className="text-sm font-medium">Ocultar marca "Sua Base"</p>
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
