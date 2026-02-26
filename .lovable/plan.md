

## Plano: Corrigir upload de logo — salvar automaticamente + cache busting

### Problema identificado

1. **Upload não persiste**: `handleLogoUpload` atualiza apenas o estado local do formulário (`setForm`), mas **não chama `saveBranding()`**. O mesmo ocorre com `handleLogoRemove`. A logo só é salva no banco se o usuário clicar "Salvar alterações" depois.

2. **Cache do navegador**: A URL pública é sempre a mesma (`{tenantId}/logo.png`), então ao re-enviar uma nova imagem, o navegador pode exibir a versão antiga.

### Alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/app/BrandingSettings.tsx` | Chamar `saveBranding()` automaticamente após upload e remoção; adicionar parâmetro de cache busting (`?t=timestamp`) na URL |

### Detalhes técnicos

**`handleLogoUpload`** (linhas 86-115):
- Após obter a URL pública, adicionar `?t=${Date.now()}` para invalidar cache
- Chamar `saveBranding({ ...form, logo_url: urlComTimestamp })` imediatamente após o upload
- Remover a necessidade de clicar "Salvar" separadamente para a logo

**`handleLogoRemove`** (linhas 117-131):
- Após limpar `logo_url`, chamar `saveBranding({ ...form, logo_url: "" })` automaticamente

### Resultado

- Ao enviar uma logo, ela será salva automaticamente no banco e aparecerá imediatamente no header e footer
- Ao remover, a remoção também será persistida automaticamente
- Re-uploads sempre mostrarão a imagem nova graças ao parâmetro de cache busting

