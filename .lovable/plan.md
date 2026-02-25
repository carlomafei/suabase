

## Diagnóstico: Cliente "Carlos Alberto Porfida Mafei" duplicado

### Causa raiz

O contato foi criado **duas vezes** pelo `bling-sync`, com 3 minutos de diferença (10:42 e 10:45). Isso aconteceu porque:

1. **O contato não tem CPF/CNPJ** — ambos os registros mostram `cpf_cnpj: null`
2. **A deduplicação só funciona por CPF** — o código da edge function (linhas 196-207) só busca contato existente se houver `cpf` preenchido
3. **Sem CPF, sempre cria um novo contato** — quando `cpf` é `null`, o código pula a busca e vai direto para o `insert` (linha 209)

Ou seja: o botão de sincronizar foi clicado duas vezes (ou o cron rodou logo após o manual), e como o Bling não retornou CPF para esse cliente, o sistema não conseguiu identificar que já existia.

### Plano de correção

#### 1. Melhorar deduplicação na edge function (`bling-sync/index.ts`)

Adicionar uma **segunda camada de deduplicação por nome + tenant** quando CPF não está disponível. E uma **terceira camada por `external_id` do Bling** (o ID do contato no Bling, que já é salvo):

```text
Ordem de busca:
1. Por CPF/CNPJ (se disponível) → mais confiável
2. Por external_id do Bling (contato.id) → identifica o mesmo contato entre syncs
3. Fallback: por nome exato → última tentativa
Só cria novo contato se nenhuma das 3 buscas encontrar resultado.
```

#### 2. Remover o registro duplicado do banco

Executar SQL para deletar o contato duplicado (o mais recente, `dfb612bc`) e reatribuir os pedidos vinculados a ele para o contato original (`a003abb3`).

#### 3. Adicionar constraint UNIQUE no banco (opcional mas recomendado)

Criar um índice único parcial em `contacts` para `(tenant_id, external_id)` quando `external_id IS NOT NULL`, prevenindo duplicatas a nível de banco.

---

### Detalhes técnicos

**Arquivos afetados:**

| Arquivo | Mudança |
|---|---|
| `supabase/functions/bling-sync/index.ts` | Deduplicação por `external_id` do Bling e por nome quando CPF é nulo |

**SQL para corrigir os dados existentes:**
```sql
-- Reatribuir pedidos do duplicado para o original
UPDATE orders SET contact_id = 'a003abb3-fcf6-49b5-a192-409eea08339e'
WHERE contact_id = 'dfb612bc-0acb-4159-9b2b-a3043ec3783e';

-- Remover o duplicado
DELETE FROM contacts WHERE id = 'dfb612bc-0acb-4159-9b2b-a3043ec3783e';
```

**Migração para índice único:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_external_id
ON contacts (tenant_id, external_id)
WHERE external_id IS NOT NULL;
```

**Lógica atualizada de deduplicação:**
```text
1. Se tem CPF → busca por (tenant_id, cpf_cnpj)
2. Se tem external_id (contato Bling) → busca por (tenant_id, external_id)
3. Se nenhum achou → busca por (tenant_id, name) com match exato
4. Se nenhum achou → INSERT novo contato
```

