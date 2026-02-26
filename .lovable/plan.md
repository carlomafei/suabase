

## Plano: Dados primários do contato vindos do cadastro Bling (GET /contatos/{id})

### Problema
Atualmente o `fetchBlingContact` só é chamado quando `cpf_cnpj` está vazio. Mas o cadastro de Clientes e Fornecedores do Bling é a fonte autoritativa de todos os dados do contato (nome, CPF/CNPJ, email, telefone). O correto é **sempre** buscar do cadastro.

### Alteração

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `supabase/functions/bling-sync/index.ts` | Sempre chamar `fetchBlingContact` quando `order.contato.id` existe; usar dados do cadastro (nome, cpf_cnpj/numeroDocumento, email, celular/fone) como fonte primária, com fallback para os dados do pedido; atualizar contatos existentes no banco com dados mais completos |

### Detalhe técnico

**Fluxo atualizado** (linhas ~205-270):

```typescript
if (order.contato) {
  const blingContactId = String(order.contato.id);
  
  // SEMPRE buscar dados completos do cadastro de Clientes/Fornecedores
  let contactName = order.contato.nome;
  let cpf: string | null = order.contato.cpf_cnpj?.replace(/[^0-9]/g, "") || null;
  let email: string | null = order.contato.email || null;
  let phone: string | null = order.contato.fone || null;

  if (order.contato.id) {
    const blingContact = await fetchBlingContact(order.contato.id, accessToken);
    await delay(150);
    if (blingContact) {
      // Dados do cadastro prevalecem sobre dados do pedido
      const rawCpf = blingContact.cpf_cnpj || blingContact.numeroDocumento;
      if (rawCpf) cpf = rawCpf.replace(/[^0-9]/g, "");
      if (blingContact.nome) contactName = blingContact.nome;
      if (blingContact.email) email = blingContact.email;
      if (blingContact.celular || blingContact.fone) phone = blingContact.celular || blingContact.fone;
    }
  }

  // Deduplicação (3 tiers, como hoje)...
  // No insert E no update, usar contactName, cpf, email, phone
```

**Expandir `fetchBlingContact`** para retornar todos os campos relevantes:
```typescript
async function fetchBlingContact(contactId: number, accessToken: string): Promise<{
  cpf_cnpj?: string; numeroDocumento?: string;
  nome?: string; email?: string; celular?: string; fone?: string;
} | null>
```

**Após deduplicação**, atualizar contato existente com dados mais completos:
```typescript
if (contactId) {
  const updates: any = {};
  if (cpf) updates.cpf_cnpj = cpf;
  if (email) updates.email = email;
  if (phone) updates.phone = phone;
  if (Object.keys(updates).length > 0) {
    await supabase.from("contacts").update(updates).eq("id", contactId);
  }
}
```

### Resultado
- CPF/CNPJ, nome, email e telefone sempre vêm do cadastro autoritativo do Bling
- Contatos existentes são enriquecidos automaticamente a cada sync
- Pedidos existentes atualizam na próxima sincronização

