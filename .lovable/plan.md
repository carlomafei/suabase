

## Implementar tema Light no Branding

### Situação atual
O sistema possui apenas um tema dark definido em `src/index.css` (`:root`). Não existe definição de tema claro nem seletor de tema na tela de Branding.

### Plano

**1. Adicionar variáveis CSS do tema Light** (`src/index.css`)
- Criar um bloco `.light` (ou `:root.light`) com todas as variáveis de cor invertidas para fundo claro:
  - `--background: 0 0% 100%`, `--foreground: 220 20% 10%`
  - `--card: 0 0% 98%`, `--muted: 220 14% 95%`, etc.
  - Manter `--primary` e `--accent` dinâmicos (aplicados via JS do branding)

**2. Adicionar campo `theme_mode` ao BrandingSettings** (`src/hooks/useBranding.ts`)
- Novo campo na interface: `theme_mode: "dark" | "light"`
- Default: `"dark"`
- Persistido em `tenants.settings.theme_mode`
- No `useEffect`, aplicar/remover a classe `light` no `document.documentElement`

**3. Adicionar seletor de tema na tela de Branding** (`src/pages/app/BrandingSettings.tsx`)
- Nova seção "Tema" com dois botões visuais (Dark / Light) ou um toggle
- Atualiza `form.theme_mode` ao clicar

**4. Aplicar a classe no layout** (`src/hooks/useBranding.ts`)
- No `useEffect` existente, adicionar:
```typescript
if (branding.theme_mode === "light") {
  document.documentElement.classList.add("light");
} else {
  document.documentElement.classList.remove("light");
}
```

### Variáveis Light propostas

```text
Dark (atual)                    Light (novo)
─────────────────────────────   ─────────────────────────────
--background: 220 20% 4%       --background: 0 0% 100%
--foreground: 0 0% 95%         --foreground: 220 20% 10%
--card: 220 18% 7%             --card: 0 0% 98%
--muted: 220 14% 14%           --muted: 220 14% 96%
--muted-foreground: 220 10% 55%  --muted-foreground: 220 10% 40%
--border: 220 14% 14%          --border: 220 14% 90%
--input: 220 14% 18%           --input: 220 14% 92%
--secondary: 220 16% 12%      --secondary: 220 16% 96%
--sidebar-background: 220 18% 7%  --sidebar-background: 0 0% 98%
```

### Nenhuma migração de banco necessária
O campo `theme_mode` será salvo no JSON `settings` da tabela `tenants`, que já aceita campos livres.

