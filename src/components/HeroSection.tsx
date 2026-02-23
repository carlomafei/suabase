import { ArrowRight, Shield, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Glow effect */}
      <div className="absolute inset-0 glow-top" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                          linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="container relative z-10 px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-8 animate-fade-in">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-sm font-medium text-primary">Para sellers de marketplace</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Pare de alugar clientes.{" "}
            <span className="text-gradient">Construa sua base.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Capture WhatsApp e e-mail dos seus clientes de marketplace logo após a compra. 
            Transforme comissão em <strong className="text-foreground">investimento</strong>, não custo.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Button size="lg" className="text-lg px-8 py-6 font-display font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(152_76%_46%/0.3)]">
              Comece grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 font-display border-muted-foreground/20 text-foreground hover:bg-secondary">
              Ver como funciona
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {[
              { icon: Users, value: "12.400+", label: "Contatos capturados" },
              { icon: TrendingUp, value: "3.2x", label: "Mais recompra" },
              { icon: Shield, value: "100%", label: "Seus dados, sua base" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="h-5 w-5 text-primary mb-1" />
                <span className="text-2xl font-display font-bold text-foreground">{value}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
