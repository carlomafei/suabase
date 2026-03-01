

## Ocultar integrações de Data Broker para usuários comuns

### Problema
A lista `PROVIDER_CONFIGS` é estática e a tela de integrações renderiza todas as categorias para qualquer usuário autenticado. As integrações Deskdata e Data Broker (Genérico) deveriam ser visíveis **apenas no painel Super Admin**.

### Correção

**Arquivo: `src/pages/app/IntegrationSettings.tsx`**

Filtrar a categoria `data_broker` da lista de categorias exibidas. A tela do tenant mostrará apenas `erp` e `whatsapp`:

```typescript
const categories: IntegrationCategory[] = ["erp", "whatsapp"];
```

Isso remove completamente a seção "Data Broker" (incluindo Deskdata e Data Broker Genérico) da tela de configurações do tenant.

A configuração dessas integrações continuará sendo feita pelo Super Admin via painel administrativo, que já possui acesso direto ao banco via `admin-api`.

### Alternativa
Se no futuro for necessário que o admin do tenant veja (mas não edite) o status do Data Broker, podemos adicionar uma verificação de role com `is_super_admin` para controlar a visibilidade. Mas por ora, a remoção simples da categoria é suficiente e mais segura.

