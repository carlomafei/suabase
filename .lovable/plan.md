

## Integração Deskdata como Data Broker

Analisei a documentação completa da API Deskdata. Aqui está o resumo da API e o plano de implementação.

### API Deskdata - Resumo Técnico

| Recurso | Método | Endpoint |
|---------|--------|----------|
| Autenticação | POST | `https://api.deskdata.com.br/auth` (username/password → access_token) |
| Consultas | POST | `https://api.deskdata.com.br/queries` |
| Saldo de créditos | GET | `https://api.deskdata.com.br/credits` |

**Autenticação**: Username + Password gera um `access_token` (Bearer token) com validade configurável (1-87600 horas).

**Consultas disponíveis** (datasets): `basic`, `phones`, `emails`, `addresses` -- todos no mesmo endpoint `/queries`, basta incluir no array `datasets`.

**Chaves de busca**: `cpf`, `name`, `email`, `phone`.

**Formato da requisição**:
```text
POST /queries
Authorization: Bearer <access_token>
{
  "type": "persons",
  "key_type": "cpf",
  "key_value": "00000000000",
  "datasets": ["basic", "phones", "emails", "addresses"]
}
```

**Formato da resposta** (code 4000 = sucesso):
```text
{
  "status": { "code": 4000, "message": "Success" },
  "data": {
    "basic": { age, birth_date, gender, name, ... },
    "phones": { total, items: [{ number, type, ... }] },
    "emails": { total, items: [{ email, type, ... }] },
    "addresses": { total, items: [{ street, city, state, ... }] }
  }
}
```

---

### Plano de implementação

| # | Onde | Mudança |
|---|------|---------|
| 1 | **`src/hooks/useIntegrations.ts`** | Adicionar `"deskdata"` ao tipo `IntegrationProvider` e novo item em `PROVIDER_CONFIGS` com campos: `username`, `password` (credenciais Deskdata) |
| 2 | **`supabase/functions/data-broker/index.ts`** | Adicionar adaptador `queryDeskdata` que: (a) autentica com username/password para obter access_token, (b) consulta `/queries` com datasets `["basic", "phones", "emails"]`, (c) normaliza resposta para `BrokerResult` |
| 3 | **`src/pages/app/IntegrationSettings.tsx`** | Incluir `"data_broker"` no array `categories` para que a seção Data Broker apareça na UI dos tenants |

### Detalhes técnicos

**Adaptador `queryDeskdata`** na edge function:
1. `POST https://api.deskdata.com.br/auth` com `{ username, password }` → recebe `access_token`
2. `POST https://api.deskdata.com.br/queries` com `Authorization: Bearer <token>`, body: `{ type: "persons", key_type: "cpf", key_value: cpf, datasets: ["basic", "phones", "emails"] }`
3. Extrai do retorno: primeiro telefone celular → `whatsapp`, primeiro e-mail → `email`, primeiro telefone fixo → `phone`
4. Armazena resposta completa em `metadata` para enriquecimento futuro

**Credenciais por tenant**: As credenciais (username/password da Deskdata) ficam em `tenant_integrations.credentials` -- cada tenant configura as suas. O token é obtido em tempo real a cada consulta (sem cache, para simplificar).

