

## Diagnóstico

O problema é **RLS (Row Level Security)**. As páginas do painel admin (Tenants, Métricas) consultam as tabelas diretamente pelo cliente com `supabase.from("tenants").select(...)`. As políticas RLS só permitem ver dados do próprio tenant do usuário logado — mesmo sendo super admin.

Não existe nenhuma edge function `admin-api` implementada ainda para contornar isso.

## Solução

Criar uma edge function `admin-api` que usa `service_role` para buscar dados globais, validando que o chamador é super admin.

| # | Onde | Mudança |
|---|------|---------|
| 1 | **`supabase/functions/admin-api/index.ts`** | Nova edge function com actions: `list_tenants`, `list_users`, `global_metrics`. Valida super admin via RPC, usa service_role client para queries sem RLS |
| 2 | **`src/pages/admin/AdminTenants.tsx`** | Trocar query direta por chamada à edge function `admin-api` com action `list_tenants` |
| 3 | **`src/pages/admin/AdminMetrics.tsx`** | Chamar `admin-api` com action `global_metrics` para obter contagens reais (total tenants, usuários, MRR) |
| 4 | **`src/pages/admin/AdminUsers.tsx`** (novo) | Nova página listando todos os usuários (nome, e-mail, tenant, role) via action `list_users` |
| 5 | **`src/App.tsx`** | Adicionar rota `/admin/users` |
| 6 | **`src/components/AdminLayout.tsx`** | Adicionar "Usuários" no menu lateral |
| 7 | **`supabase/config.toml`** | Desabilitar JWT verify para `admin-api` (validação feita no código) |

### Edge function `admin-api`

```text
POST /admin-api
Body: { "action": "list_tenants" | "list_users" | "global_metrics" }

1. Extrai user do token Authorization
2. Verifica is_super_admin via RPC
3. Se não for SA → 403
4. Executa query com service_role client
5. Retorna dados
```

**`list_users`** — junta `profiles`, `tenant_users` e `tenants` para retornar: user_id, full_name, email (de auth.users via admin API), tenant_name, role, created_at. Usa paginação para ultrapassar o limite de 1000 rows.

**`global_metrics`** — retorna counts agregados: total_tenants, total_users, total_contacts, MRR (soma de planos ativos).

