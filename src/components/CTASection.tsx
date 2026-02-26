import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="py-24 relative">
      <div className="container px-4">
        <div className="max-w-3xl mx-auto text-center card-gradient rounded-2xl border border-primary/20 p-12 md:p-16 relative overflow-hidden">
          {/* Glow */}
          <div className="absolute inset-0 glow-top opacity-60" />

          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Comece a construir <span className="text-gradient">sua base própria</span> hoje
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
              Pare de depender 100% dos marketplaces. Cada venda é uma oportunidade de criar um relacionamento direto.
            </p>
            <Button size="lg" className="text-lg px-8 py-6 font-display font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(152_76%_46%/0.3)]">
              Criar minha conta grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-muted-foreground text-xs mt-4">
              Sem cartão de crédito • Setup em 2 minutos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
