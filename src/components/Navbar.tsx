import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useBranding } from "@/hooks/useBranding";

const Navbar = () => {
  const { branding } = useBranding();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.platform_name || "Logo"} className="h-7 max-w-[140px] object-contain" />
          ) : (
            <span className="font-display font-bold text-xl">{branding.platform_name || "Sua Base"}</span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#problema" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Problema</a>
          <a href="#solucao" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Solução</a>
          <a href="#preco" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Preços</a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Entrar
            </Button>
          </Link>
          <Link to="/auth?mode=signup">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-display font-medium">
              Começar grátis
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
