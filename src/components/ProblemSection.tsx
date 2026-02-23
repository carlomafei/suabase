import { AlertTriangle, DollarSign, Swords, Ban } from "lucide-react";

const problems = [
  {
    icon: DollarSign,
    title: "Comissões de 14% a 24%",
    description: "Suas margens evaporam a cada venda. O marketplace cresce, você sobrevive.",
  },
  {
    icon: Swords,
    title: "Guerra de preços infinita",
    description: "Sua marca vira 'mais um anúncio'. Sem diferenciação, sem lealdade.",
  },
  {
    icon: AlertTriangle,
    title: "Regras mudam do dia para noite",
    description: "Uma mudança de algoritmo pode derrubar seu faturamento inteiro.",
  },
  {
    icon: Ban,
    title: "O cliente não é seu",
    description: "Ele pertence à plataforma. Você só aluga o acesso a ele.",
  },
];

const ProblemSection = () => {
  return (
    <section className="py-24 relative">
      <div className="container px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-primary font-medium mb-3 font-display">O problema real</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6">
            Você está construindo um castelo em{" "}
            <span className="text-gradient">terreno alugado</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Cada venda parece uma vitória. Mas por trás dos números, há uma realidade dolorosa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {problems.map(({ icon: Icon, title, description }, i) => (
            <div
              key={title}
              className="card-gradient rounded-xl border border-border/50 p-6 hover:border-destructive/30 transition-colors group"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-destructive/10 p-2.5 shrink-0 group-hover:bg-destructive/20 transition-colors">
                  <Icon className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
