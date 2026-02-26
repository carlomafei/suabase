import { ArrowRight, MessageCircle, Mail, Repeat, Zap } from "lucide-react";

const steps = [
  {
    icon: Zap,
    step: "01",
    title: "Cliente compra no marketplace",
    description: "Cada venda no Mercado Livre, Shopee ou Amazon aciona automaticamente o Taqt.",
  },
  {
    icon: MessageCircle,
    step: "02",
    title: "Captura de WhatsApp e e-mail",
    description: "No momento mais valioso — logo após a compra — você coleta o contato do cliente.",
  },
  {
    icon: Mail,
    step: "03",
    title: "Fale direto com seu cliente",
    description: "Sem intermediários. Envie ofertas, novidades e construa relacionamento real.",
  },
  {
    icon: Repeat,
    step: "04",
    title: "Comissão vira investimento",
    description: "Cada venda no marketplace agora gera um ativo: seu próprio banco de clientes.",
  },
];

const SolutionSection = () => {
  return (
    <section className="py-24 relative">
      {/* Subtle glow */}
      <div className="absolute inset-0 glow-top opacity-50" />

      <div className="container px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-primary font-medium mb-3 font-display">A virada de chave</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6">
            Transforme comissão em{" "}
            <span className="text-gradient">aquisição de cliente</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Com o Taqt, cada venda no marketplace gera um cliente para sua base própria.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {steps.map(({ icon: Icon, step, title, description }, i) => (
            <div
              key={step}
              className="relative flex items-start gap-6 card-gradient rounded-xl border border-border/50 p-6 hover:border-primary/30 transition-colors group"
            >
              <div className="shrink-0">
                <span className="font-display text-3xl font-bold text-primary/30 group-hover:text-primary/60 transition-colors">
                  {step}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-semibold text-lg">{title}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="absolute -bottom-5 left-10 h-4 w-4 text-primary/30 rotate-90" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
