import { Receipt } from "lucide-react";

const AdminSubscriptions = () => (
  <div>
    <div className="mb-8">
      <h1 className="font-display text-2xl md:text-3xl font-bold">Assinaturas</h1>
      <p className="text-muted-foreground mt-1">Acompanhe todas as assinaturas ativas</p>
    </div>
    <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
      <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">A listagem de assinaturas será exibida aqui.</p>
    </div>
  </div>
);

export default AdminSubscriptions;
