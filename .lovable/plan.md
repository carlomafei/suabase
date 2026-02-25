

## Plano: Preparar o enriquecimento de dados para funcionar assim que um provedor for configurado

### Situação atual

| Componente | Status |
|---|---|
| Botão "Enriquecer" na página de Clientes | **Placeholder** — simula espera de 1.5s, só atualiza `enriched_at`, não chama nenhuma API |
| Edge function `data-broker` | **Pronta** — suporta Neoway, Assertiva, BigDataCorp, mas ninguém a chama |
| Configuração do Data Broker em Integrações | **Parcial** — tem campos `api_url` e `api_key`, mas falta o campo `provider_type` (neoway/assertiva/bigdatacorp) |
| Enriquecimento automático no `bling-sync` | **Não existe** — novos contatos são criados sem enfileirar enriquecimento |

### O que será implementado

#### 1. Conectar o botão "Enriquecer" à edge function real

**Arquivo:** `src/pages/app/Contacts.tsx`

Substituir o `handleEnrich` placeholder por uma chamada real ao `data-broker`. Se o provedor não estiver configurado, mostrar um toast orientando o usuário a configurar nas Integrações.

```text
Fluxo:
1. Chamar supabase.functions.invoke('data-broker', { body: { tenant_id, contact_id, cpf, nome } })
2. Se sucesso → toast "Dados enriquecidos!" + recarregar lista
3. Se erro "Data Broker não configurado" → toast "Configure um Data Broker em Configurações > Integrações"
4. Se outro erro → toast com mensagem de erro
```

#### 2. Adicionar campo `provider_type` na configuração do Data Broker

**Arquivo:** `src/hooks/useIntegrations.ts`

Adicionar um campo `provider_type` (select: neoway, assertiva, bigdatacorp) nos `credentialFields` do Data Broker para que o `data-broker` saiba qual adaptador usar.

**Arquivo:** `src/hooks/useIntegrations.ts` + `src/pages/app/IntegrationSettings.tsx`

Salvar `provider_type` em `settings.provider_type` (não em `credentials`), já que é uma configuração e não uma credencial. Adicionar suporte a campo tipo `select` no dialog de configuração.

#### 3. Enriquecimento automático de novos contatos no bling-sync

**Arquivo:** `supabase/functions/bling-sync/index.ts`

Após criar um novo contato (linha 232-249), inserir um job `enrich_contact` na tabela `jobs` para que o `job-worker` processe o enriquecimento automaticamente:

```text
Após INSERT de novo contato:
  INSERT INTO jobs (tenant_id, type, payload, status)
  VALUES (tenantId, 'enrich_contact', { contact_id, cpf, nome }, 'pending')
```

O `job-worker` já tem o case `enrich_contact` implementado — ele chamará o `data-broker` automaticamente.

Se o Data Broker não estiver configurado, o job falhará silenciosamente (sem impactar o sync).

### Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/app/Contacts.tsx` | `handleEnrich` chama `data-broker` de verdade |
| `src/hooks/useIntegrations.ts` | Adicionar campo `provider_type` (select) ao Data Broker |
| `src/pages/app/IntegrationSettings.tsx` | Suporte a campo tipo `select` no dialog + salvar `provider_type` em `settings` |
| `supabase/functions/bling-sync/index.ts` | Enfileirar job `enrich_contact` ao criar novo contato |

### Resultado esperado

- **Agora:** Tudo fica preparado. O botão "Enriquecer" mostrará "Configure um Data Broker" se não houver provedor ativo.
- **Quando contratar um provedor:** Basta ir em Configurações > Integrações > Data Broker, selecionar o provedor, inserir URL e API Key. A partir daí, o enriquecimento funciona tanto manual (botão) quanto automático (novos contatos do Bling).

