

## Problema

O dialog de Data Broker em `AdminTenants.tsx` tem o select de provedores hardcoded com apenas Neoway, Assertiva e BigDataCorp (linhas 212-214). Não inclui Deskdata. Além disso, os campos do formulário são fixos (API URL + API Key), que não servem para Deskdata (que usa username + password).

## Solução

Atualizar `src/pages/admin/AdminTenants.tsx`:

| # | Mudança |
|---|---------|
| 1 | Adicionar "Deskdata" como opção no `<Select>` de provedor |
| 2 | Tornar os campos do formulário dinâmicos: se `provider_type === "deskdata"`, mostrar campos Username + Password; caso contrário, mostrar API URL + API Key |
| 3 | Ajustar `handleSave` para salvar com `provider: "deskdata"` quando selecionado (em vez de `"data_broker"`), e usar as credenciais corretas (username/password) |
| 4 | Ajustar `openDataBrokerDialog` para também buscar integração com `provider = "deskdata"` se não encontrar `data_broker` |

### Detalhes

O formulário alterna dinamicamente:
- **Deskdata**: campos `username` e `password`, salva com `provider: "deskdata"`
- **Outros**: campos `api_url` e `api_key`, salva com `provider: "data_broker"` e `settings.provider_type`

