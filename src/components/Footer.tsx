import { useBranding } from "@/hooks/useBranding";
import logoTaqt from "@/assets/logo-taqt.png";

const Footer = () => {
  const { branding } = useBranding();

  const platformName = branding.platform_name || "Taqt";
  const footerText = branding.footer_text || `© ${new Date().getFullYear()} ${platformName}. Todos os direitos reservados.`;
  const logoSrc = branding.logo_url || logoTaqt;

  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt={platformName} className="h-8 max-w-[160px] object-contain" />
          </div>
          <p className="text-sm text-muted-foreground">
            {footerText}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
