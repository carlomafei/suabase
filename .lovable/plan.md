

## Ajustes no painel lateral de pedidos

### Mudanças em `src/pages/app/Orders.tsx`

| # | Mudança |
|---|---------|
| 1 | Adicionar coluna **Ações** na tabela com ícone `Eye` clicável — remover o `onClick` da `TableRow` para que apenas o ícone abra o painel |
| 2 | Alterar a altura do painel lateral de `h-[calc(100vh-280px)]` para ocupar a **tela toda** — usar `fixed inset-y-0 right-0` com largura ~35% e `z-50`, com overlay escuro atrás (estilo Sheet) |
| 3 | Manter a largura da tabela em 100% (sem encolher), o painel fica sobreposto |

### Detalhes

- Coluna Ações: `<TableHead>Ações</TableHead>` + `<TableCell>` com botão `Eye` que chama `handleSelectOrder(order)`
- Painel: posição `fixed top-0 right-0 h-screen w-[400px]` com fundo branco, sombra e botão X para fechar
- Overlay: div `fixed inset-0 bg-black/50` clicável para fechar
- Remove `cursor-pointer` e `onClick` do `TableRow`, remove a lógica de `w-[65%]`

