import { useEffect, useState } from "react";
import { Users, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface UserEntry {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
  memberships: { tenant_name: string; role: string; is_active: boolean }[];
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("admin-api", {
        body: { action: "list_users" },
      });
      if (res.data?.users) setUsers(res.data.users);
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground mt-1">
          Todos os usuários cadastrados na plataforma ({users.length})
        </p>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border/50 p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">E-mail</TableHead>
                  <TableHead className="text-xs">Tenant</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id} className="border-border/50">
                    <TableCell className="text-sm font-medium">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.memberships.length === 0
                        ? "—"
                        : u.memberships.map((m, i) => (
                            <span key={i}>
                              {m.tenant_name}
                              {i < u.memberships.length - 1 ? ", " : ""}
                            </span>
                          ))}
                    </TableCell>
                    <TableCell>
                      {u.memberships.length === 0 ? (
                        <Badge variant="secondary" className="text-xs">—</Badge>
                      ) : (
                        u.memberships.map((m, i) => (
                          <Badge key={i} variant="secondary" className="text-xs mr-1">
                            {m.role}
                          </Badge>
                        ))
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminUsers;
