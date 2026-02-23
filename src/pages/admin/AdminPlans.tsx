import { CreditCard } from "lucide-react";

const AdminPlans = () => (
  <div>
    <div className="mb-8">
      <h1 className="font-display text-2xl md:text-3xl font-bold">Planos</h1>
      <p className="text-muted-foreground mt-1">Configure os planos disponíveis na plataforma</p>
    </div>
    <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
      <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">O gerenciamento de planos será exibido aqui.</p>
    </div>
  </div>
);

export default AdminPlans;
