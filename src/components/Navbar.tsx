import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <span className="font-display font-bold text-xl">Sua Base</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#problema" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Problema</a>
          <a href="#solucao" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Solução</a>
          <a href="#preco" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Preços</a>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Entrar
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-display font-medium">
            Começar grátis
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
