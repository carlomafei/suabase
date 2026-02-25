

## Plano: Botão Manual + Agendamento Automático do Bling Sync

Sim, é totalmente possível ter as duas funções. O botão manual serve para sincronizar sob demanda, e o cron garante que os pedidos sejam atualizados automaticamente a cada 15 minutos.

---

### Alterações necessárias

#### 1. Adaptar `bling-sync` para dois modos

A edge function precisa funcionar em dois cenários:

```text
COM tenant_id no body → Modo manual (exige JWT do usuário)
COM { "cron": true }  → Modo automático (busca todos os tenants com Bling ativo)
```

No modo cron, a função usará a service role key para iterar por todas as integrações Bling ativas e sincronizar cada uma sequencialmente. Sem necessidade de autenticação de usuário.

#### 2. Botão "Sincronizar Pedidos" no card do Bling (IntegrationSettings)

Visível apenas quando o OAuth está conectado. Chama `supabase.functions.invoke('bling-sync', { body: { tenant_id } })` com feedback de loading e toast.

#### 3. Botão "Sincronizar Bling" na página de Pedidos (Orders)

No header da página, ao lado do badge de contagem, um botão que dispara a mesma chamada. Inclui spinner durante a execução e recarrega a lista ao terminar.

#### 4. Cron job via pg_cron + pg_net

SQL executado no banco para agendar uma chamada HTTP POST à função a cada 15 minutos, com `{"cron": true}` no body.

---

### Detalhes técnicos

**Arquivos afetados:**

| Arquivo | Mudança |
|---|---|
| `supabase/functions/bling-sync/index.ts` | Adicionar modo cron: se body `{ "cron": true }`, buscar todos tenants com Bling ativo e sincronizar cada um sem exigir JWT |
| `src/pages/app/IntegrationSettings.tsx` | Botão "Sincronizar Pedidos" no card Bling quando OAuth conectado |
| `src/pages/app/Orders.tsx` | Botão "Sincronizar Bling" no header com loading + toast + refresh |

**SQL do cron job** (executado via insert tool):
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'bling-sync-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ntfpzslkdlrpcgrmxsay.supabase.co/functions/v1/bling-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50ZnB6c2xrZGxycGNncm14c2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mzc1OTQsImV4cCI6MjA4NzQxMzU5NH0.ntkNb2d8XErBeYUO3_E1PO3QHo7CHRA3LWK8ZGQBxWA"}'::jsonb,
    body := '{"cron": true}'::jsonb
  ) AS request_id;
  $$
);
```

**Lógica do modo cron na edge function:**
```text
1. Detecta body { "cron": true }
2. Pula validação de JWT
3. Busca todos tenant_integrations WHERE provider='bling' AND is_active=true
4. Para cada integração: refresh token se necessário → buscar pedidos → upsert
5. Retorna resumo agregado de todos os tenants
```

**Frequência:** 15 minutos (ajustável depois para 5, 10, 30 ou 60 min).

