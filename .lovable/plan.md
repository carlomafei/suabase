

## Plano: Integração Bling ERP via OAuth 2.0 (API V3)

### Situação atual

- A integração Bling já existe em `useIntegrations.ts` com campos `api_key`, `client_id`, `client_secret` — mas espera um token estático, sem fluxo OAuth real
- A edge function `bling-sync` usa `creds.api_key` como `access_token` diretamente — sem refresh automático
- A tabela `tenant_integrations` já possui campos `credentials` (jsonb) e `settings` (jsonb) que comportam tokens OAuth
- O card na tela de Configurações > Integrações já renderiza o Bling com botão "Configurar"

### Fluxo OAuth 2.0 do Bling (Authorization Code)

```text
1. Usuário clica "Conectar Bling" na UI
2. Frontend redireciona para:
   https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=XXX&state=TENANT_ID
3. Bling redireciona para callback URL (edge function)
4. Edge function troca o code por access_token + refresh_token
5. Tokens são salvos em tenant_integrations.credentials
6. Usuário é redirecionado de volta para /app/settings
```

---

### Alterações planejadas

#### 1. Nova edge function `bling-oauth-callback`

Recebe o `code` e `state` (tenant_id) do redirect do Bling, faz POST para `https://www.bling.com.br/Api/v3/oauth/token` com Basic Auth (client_id:client_secret), salva `access_token`, `refresh_token` e `expires_at` no campo `credentials` da `tenant_integrations`, e redireciona o usuário para `/app/settings`.

#### 2. Atualizar `useIntegrations.ts` — campos do Bling

Mudar os `credentialFields` do Bling para apenas `client_id` e `client_secret` (remover `api_key`). Adicionar um método para gerar a URL de autorização e um indicador de "conectado via OAuth" baseado na presença de `access_token` nos credentials.

#### 3. Atualizar `IntegrationSettings.tsx` — botão OAuth

Para o Bling especificamente, quando já tem `client_id` e `client_secret` salvos mas não tem `access_token`, exibir botão "Conectar ao Bling" que redireciona para o endpoint de autorização. Quando já tem token, exibir status "Conectado" com data de expiração.

#### 4. Atualizar `bling-sync/index.ts` — auto-refresh de token

Antes de chamar a API, verificar se o `access_token` expirou (comparar `expires_at` com `now()`). Se expirou, usar o `refresh_token` para obter novo access_token via POST para `/oauth/token` com `grant_type=refresh_token`, atualizar `credentials` no banco, e prosseguir com a sincronização.

#### 5. Rota de callback no frontend

Adicionar rota `/app/bling/callback` no `App.tsx` que captura `?code=XXX&state=YYY` da query string e chama a edge function `bling-oauth-callback` para completar o fluxo.

---

### Detalhes técnicos

**Arquivos afetados:**

| Arquivo | Mudança |
|---|---|
| `supabase/functions/bling-oauth-callback/index.ts` | Novo — troca code por tokens |
| `supabase/functions/bling-sync/index.ts` | Adicionar lógica de refresh automático |
| `src/hooks/useIntegrations.ts` | Remover campo `api_key`, adicionar helper OAuth |
| `src/pages/app/IntegrationSettings.tsx` | Botão "Conectar ao Bling" com redirect OAuth |
| `src/App.tsx` | Nova rota `/app/bling/callback` |
| `src/pages/app/BlingCallback.tsx` | Novo — página intermediária que processa o callback |

**Credenciais armazenadas em `tenant_integrations.credentials`:**
```json
{
  "client_id": "...",
  "client_secret": "...",
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": "2026-02-25T02:00:00Z"
}
```

**Segurança:**
- O `client_secret` fica no banco com RLS (somente admin do tenant pode ler)
- O `state` no OAuth carrega o `tenant_id` para vincular ao tenant correto
- A edge function valida a autenticação antes de salvar tokens

**Nenhuma migration de banco necessária** — o campo `credentials` (jsonb) já comporta os novos campos.

