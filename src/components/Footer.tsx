import { useBranding } from "@/hooks/useBranding";

const Footer = () => {
  const { branding } = useBranding();

  const platformName = branding.platform_name || "Sua Base";
  const footerText = branding.footer_text || `© ${new Date().getFullYear()} ${platformName}. Todos os direitos reservados.`;

  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={platformName}
                className="h-8 max-w-[160px] object-contain"
              />
            ) : (
              <span className="font-display font-bold">{platformName}</span>
            )}
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
