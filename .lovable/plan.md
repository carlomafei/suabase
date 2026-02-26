

## Plano: Esconder texto "Sua Base" quando logo existir

### Problema

No `AppLayout.tsx` (linha 74-76), o `<span>` com `branding.platform_name || "Sua Base"` é renderizado **sempre**, independentemente de haver logo configurada. O mesmo padrão pode existir no `Footer.tsx`.

### Alterações

| Arquivo | Mudança |
|---|---|
| `src/components/AppLayout.tsx` | Linha 74-76: Renderizar o `<span>` com nome da plataforma **apenas quando não houver** `branding.logo_url`. Se houver logo, exibe só a imagem. |
| `src/components/Footer.tsx` | Mesma lógica: exibir nome como texto apenas quando não houver logo. |

### Detalhes técnicos

**AppLayout.tsx** (linhas 71-76):
```text
Antes:  <img> (se logo_url) + <span>nome</span> (sempre)
Depois: <img> (se logo_url) OU <span>nome</span> (se não houver logo_url)
```

Condição: `{branding.logo_url ? <img> : <span>{platform_name}</span>}`

