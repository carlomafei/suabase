

## Plano: Buscar CPF/CNPJ do cadastro de contatos do Bling

### Problema
O CPF/CNPJ vem do campo `order.contato.cpf_cnpj` na listagem de vendas do Bling, mas frequentemente está vazio. A informação completa está no cadastro do contato (endpoint `GET /contatos/{id}`).

### Alteração

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `supabase/functions/bling-sync/index.ts` | Adicionar função `fetchBlingContact(contactId, accessToken)` que chama `GET /contatos/{id}` e retorna o CPF/CNPJ. Na lógica de sync, quando `order.contato.cpf_cnpj` estiver vazio, buscar do cadastro do contato antes da deduplicação. |

### Detalhe técnico

**Nova função:**
```typescript
async function fetchBlingContact(contactId: number, accessToken: string): Promise<{ cpf_cnpj?: string } | null> {
  try {
    const result = await blingFetch(`/contatos/${contactId}`, accessToken);
    return result?.data || null;
  } catch (err: any) {
    console.warn(`Failed to fetch Bling contact ${contactId}:`, err.message);
    return null;
  }
}
```

**No loop de sync**, antes da deduplicação:
```typescript
// Se cpf_cnpj veio vazio do pedido, buscar do cadastro
let cpf = order.contato.cpf_cnpj?.replace(/[^0-9]/g, "") || null;
if (!cpf && order.contato.id) {
  const blingContact = await fetchBlingContact(order.contato.id, accessToken);
  await delay(150); // rate limiting
  const rawCpf = blingContact?.cpf_cnpj || blingContact?.numeroDocumento;
  if (rawCpf) cpf = rawCpf.replace(/[^0-9]/g, "");
}
```

Isso também atualiza o contato existente no banco se o CPF estava faltando.

### Nota
- A página de Pedidos já exibe `contact_cpf` do contato salvo no banco — não precisa de alteração no frontend
- Pedidos existentes terão o CPF atualizado na próxima sincronização, desde que o contato seja encontrado e atualizado

