import { Building2, MoreHorizontal } from "lucide-react";

const AdminTenants = () => (
  <div>
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Tenants</h1>
        <p className="text-muted-foreground mt-1">Gerencie todas as empresas da plataforma</p>
      </div>
    </div>
    <div className="card-gradient rounded-xl border border-border/50 p-8 text-center">
      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">A listagem de tenants será exibida aqui.</p>
    </div>
  </div>
);

export default AdminTenants;
