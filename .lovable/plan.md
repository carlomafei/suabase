

## Plano: Ocultar Data Broker da UI e criar configuração admin

### Alterações

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/pages/app/IntegrationSettings.tsx` | Remover `data_broker` da lista de categorias visíveis (linha 114: filtrar para `["erp", "whatsapp"]`) |
| 2 | `src/pages/app/Contacts.tsx` | Remover o botão "Enriquecer" e referências ao Data Broker (linhas ~304-318) |
| 3 | `src/pages/admin/AdminTenants.tsx` | Adicionar botão/dialog para configurar Data Broker por tenant — campos: provedor (Neoway/Assertiva/BigDataCorp), API URL e API Key. Salva diretamente na tabela `tenant_integrations` via service role ou RPC |

### Detalhe técnico

**IntegrationSettings.tsx** — linha 114:
```typescript
const categories: IntegrationCategory[] = ["erp", "whatsapp"];
```

**Contacts.tsx** — remover coluna de ação "Enriquecer" e o estado `enrichingId`. O enriquecimento continua ocorrendo automaticamente via `job_queue` quando novos contatos são criados pela sincronização do Bling.

**AdminTenants.tsx** — adicionar na listagem de tenants um botão "Data Broker" que abre dialog com:
- Select de provedor (Neoway, Assertiva, BigDataCorp)
- Campo API URL
- Campo API Key
- Faz upsert direto na `tenant_integrations` com `provider = 'data_broker'`

### Como funciona depois
1. Você acessa o painel Admin → Tenants → clica "Data Broker" no tenant desejado
2. Configura provedor, URL e chave
3. O enriquecimento automático acontece via `job_queue` a cada novo contato sincronizado do Bling
4. O usuário final não vê nada sobre Data Broker na interface

