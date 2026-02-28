

## Correção: `[object Object]` no endereço dos pedidos

### Causa raiz

No banco de dados, o campo `metadata.endereco.endereco` contém **um objeto** (não uma string). Isso acontece porque o `bling-sync` salva `end.endereco` que, quando vem da API do Bling como objeto, é armazenado recursivamente — criando `endereco.endereco = {bairro, cep, complemento, ...}`.

Quando o React tenta renderizar `endereco.endereco` como texto, exibe `[object Object]`.

### Correções necessárias (2 arquivos + dados)

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `supabase/functions/bling-sync/index.ts` | Na construção do objeto endereço, verificar `typeof end.endereco === 'string'` antes de usar. Se for objeto, usar `end.endereco?.endereco` ou `end.geral?.endereco` como fallback para extrair a string da rua |
| 2 | `src/pages/app/Orders.tsx` | Adicionar fallback defensivo: se `endereco.endereco` não for string, usar `""` — evita o `[object Object]` em registros já salvos |
| 3 | **Dados existentes** | SQL para corrigir os registros que já têm o objeto aninhado, extraindo a string correta ou limpando o campo |

### Detalhes técnicos

**bling-sync (prevenção futura):**
```typescript
const rua = typeof end.endereco === 'string'
  ? end.endereco
  : (end.endereco?.endereco || end.geral?.endereco || "");
```

**Orders.tsx (fallback defensivo):**
Em cada lugar que renderiza `endereco.endereco`:
```typescript
const rua = typeof endereco.endereco === 'string' ? endereco.endereco : "";
```

**SQL de correção dos dados existentes:**
```sql
UPDATE contacts
SET metadata = jsonb_set(
  metadata,
  '{endereco,endereco}',
  '""'
)
WHERE jsonb_typeof(metadata->'endereco'->'endereco') = 'object';
```

