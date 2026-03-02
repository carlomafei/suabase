

## Implementar ramificações (branches) no nó "Classificar com IA"

### Problema atual
O fluxo de automação é uma **lista linear** de nós (`AutomationNode[]`). Não existe conceito de ramificação — após o "Classificar com IA", as ações seguem sequencialmente sem considerar o resultado da classificação.

### Solução: Branches por label no nó classify_ai

Cada rótulo de classificação (Pos., Neg., Neu.) terá sua própria sequência de ações filhas. A estrutura do nó `classify_ai` será estendida com um campo `branches`:

```text
AutomationNode (classify_ai)
├── config.labels: "Positivo, Negativo, Neutro"
├── config.branches:
│   ├── "Positivo":  [ {actionType: "send_template", config: {...}} ]
│   ├── "Negativo":  [ {actionType: "send_template", config: {...}} ]
│   └── "Neutro":    [ {actionType: "send_template", config: {...}} ]
```

### Mudanças necessárias

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/pages/app/Automations.tsx` — Tipos | Adicionar `branches?: Record<string, AutomationNode[]>` na interface `AutomationNode` |
| 2 | `src/pages/app/Automations.tsx` — Canvas | Após o card do `classify_ai`, renderizar as colunas de branch lado a lado, com linhas de conexão saindo de cada badge de label, e para cada branch um mini-fluxo vertical com botão "+" para adicionar ações |
| 3 | `src/pages/app/Automations.tsx` — Lógica | Funções `addBranchAction(nodeId, label, actionType)`, `removeBranchAction(nodeId, label, actionIndex)`, `updateBranchNodeConfig(nodeId, label, actionIndex, config)` |
| 4 | `src/pages/app/Automations.tsx` — Sync labels | Quando o usuário edita os rótulos no campo de texto, sincronizar as chaves de `branches` (adicionar novas, manter existentes, remover as que sumiram) |

### Renderização visual (canvas)

Após o card "Classificar com IA":
- Renderizar conectores que se dividem em N colunas (uma por label)
- Cada coluna mostra o nome do label no topo e lista as ações da branch verticalmente
- Cada coluna tem um botão "+" para adicionar ações naquela branch
- As ações dentro de cada branch são cards menores reutilizando a mesma lógica de config (template, wait, move_stage)
- Nós após o classify_ai no fluxo principal continuam renderizando normalmente abaixo das branches

### Dados salvos

O formato salvo no banco não muda (campo `actions` JSON). Apenas a estrutura interna do nó `classify_ai` ganha o campo `branches` dentro de `config`. Compatível com automações já existentes (sem branches = fluxo linear como antes).

### Detalhes técnicos

**Inicialização de branches ao criar nó classify_ai:**
```typescript
addAction("classify_ai") → config: {
  labels: "Positivo, Negativo, Neutro",
  branches: { "Positivo": [], "Negativo": [], "Neutro": [] }
}
```

**Renderização das branches:**
```text
       ┌─────────────────────────────────────┐
       │       Classificar com IA            │
       │  ★ Pos.    ★ Neg.    ★ Neu.        │
       └──────┬──────────┬──────────┬────────┘
              │          │          │
         ┌────▼────┐ ┌───▼────┐ ┌──▼─────┐
         │Send TPL │ │Send TPL│ │Send TPL│
         │"Que bom"│ │"Poxa"  │ │"Reenvi"│
         └─────────┘ └────────┘ └────────┘
              │          │          │
            [ + ]      [ + ]      [ + ]
```

