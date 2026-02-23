import { DollarSign } from "lucide-react";

const AdminBilling = () => (
  <div>
    <div className="mb-8">
      <h1 className="font-display text-2xl md:text-3xl font-bold">Faturamento</h1>
      <p className="text-muted-foreground mt-1">Controle financeiro da plataforma</p>
    </div>
    <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
      <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">O controle de faturamento será exibido aqui.</p>
    </div>
  </div>
);

export default AdminBilling;
