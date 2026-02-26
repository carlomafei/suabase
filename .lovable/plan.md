

## Plano: Exibir "Número Loja Virtual" como ID da Venda

### Problema
Atualmente o campo "ID Pedido" na página de Pedidos exibe o `external_id` (que é o ID interno do Bling, ex: `19283746`). O usuário precisa ver o **"Número Loja Virtual"** que vem nos detalhes da venda no Bling (campo `numeroLojaVirtual`).

### Alterações

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `supabase/functions/bling-sync/index.ts` | Adicionar `numeroLojaVirtual` na interface `BlingOrderDetail`; extrair o campo do detalhe da venda e salvar em `metadata.numero_loja_virtual` (tanto no insert quanto no update) |
| 2 | `src/pages/app/Orders.tsx` | No campo "ID Pedido", priorizar `metadata.numero_loja_virtual` sobre `external_id`; atualizar a interface `Order` para incluir `metadata` |

### Detalhe técnico

**bling-sync** — na função `syncTenant`, após `fetchOrderDetail`:
```typescript
const numeroLojaVirtual = detail?.numeroLojaVirtual || null;
```
E no insert/update do pedido, incluir no `metadata`:
```typescript
metadata: { 
  bling_numero: order.numero, 
  numero_loja_virtual: numeroLojaVirtual 
}
```

**Orders.tsx** — na coluna "ID Pedido":
```typescript
// Priorizar numero_loja_virtual > external_id > id truncado
{order.numero_loja_virtual || order.external_id || order.id.slice(0, 8)}
```

### Nota
Pedidos já sincronizados não terão o campo `numero_loja_virtual` até a próxima sincronização. Será necessário clicar "Sincronizar Bling" para atualizar os pedidos existentes com o novo campo.

