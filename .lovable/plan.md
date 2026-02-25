

## Diagnóstico: Por que o sistema não extrai a descrição/nome do produto

### Causa raiz identificada

O problema está na edge function `bling-sync`. Existem **dois motivos técnicos**:

1. **A API do Bling não retorna itens na listagem** — A rota `GET /pedidos/vendas` (usada na linha 98) retorna apenas um resumo dos pedidos (número, data, total, contato, situação). Os itens/produtos de cada pedido **não vêm nessa resposta**. Para obtê-los, é necessário chamar `GET /pedidos/vendas/{id}` individualmente para cada pedido.

2. **A coluna `items` nunca é preenchida no código** — Nas operações de insert (linha 173) e update (linha 162), a coluna `items` simplesmente não é incluída. O banco recebe `items: []` (valor default da coluna).

Confirmação no banco: todos os pedidos têm `items: []` (array vazio).

---

### Plano de correção

#### Alteração na edge function `bling-sync/index.ts`

Na função `syncTenant`, após obter a lista de pedidos, buscar o detalhe de cada pedido novo para extrair os itens:

```text
Para cada pedido na lista:
  1. GET /pedidos/vendas/{id} → retorna dados completos incluindo "itens[]"
  2. Extrair de cada item: descricao, quantidade, valor (valorUnidade)
  3. Formatar como: [{"descricao": "...", "quantidade": N, "valor": X.XX}]
  4. Salvar na coluna "items" no insert/update
```

Adicionalmente, aproveitar o detalhe para:
- **Mapear status** do Bling para o sistema (`"Em aberto"` → `"pending"`, `"Atendido"` → `"delivered"`, etc.)
- **Extrair marketplace real** do campo `loja` ou `canal` do pedido detalhado, em vez de fixar `"bling"`

#### Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/bling-sync/index.ts` | Adicionar chamada `GET /pedidos/vendas/{id}` para cada pedido, popular `items`, mapear status, extrair marketplace |

#### Detalhes da implementação

1. **Adicionar mapa de status:**
```text
"Em aberto"    → "pending"
"Atendido"     → "delivered"
"Cancelado"    → "canceled"
"Em andamento" → "processing"
"Enviado"      → "shipped"
(default)      → "pending"
```

2. **Buscar detalhes com rate limiting:** Para não sobrecarregar a API do Bling, adicionar um pequeno delay entre chamadas de detalhe (100-200ms).

3. **Otimização:** Buscar detalhe apenas para pedidos **novos** (não existentes no banco), já que pedidos já sincronizados provavelmente não mudam os itens.

4. **Extrair itens no formato esperado pelo frontend:**
```text
O frontend (Orders.tsx) já lê: item.descricao || item.nome || item.description || item.name
Então salvar como: [{"descricao": "Nome do produto", "quantidade": 2, "valor": 49.90}]
```

