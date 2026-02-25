

## Plano: Upload de logo via Storage com dica de tamanho ideal

### O que será feito

1. **Criar bucket `logos`** no Storage com leitura pública e upload restrito a usuários autenticados
2. **Substituir campo de URL** no BrandingSettings por componente de upload de imagem com preview e dica de tamanho ideal
3. **Atualizar Footer** para consumir `useBranding()` e exibir a logo dinamicamente

### Alterações

#### 1. Migração SQL — Bucket + Políticas de Storage

Criar bucket `logos` com acesso público de leitura e políticas de upload/update/delete para usuários autenticados.

#### 2. `src/pages/app/BrandingSettings.tsx` — Upload com preview + dica de tamanho

Substituir o campo `Input` de URL (linhas 131-140) por:

- Preview da logo atual (se `form.logo_url` existir)
- Input `type="file"` aceitando PNG, SVG, JPG, WebP (max 2MB)
- Upload para `logos/{tenantId}/logo.{ext}` com `upsert: true`
- URL pública salva em `form.logo_url`
- Botão "Remover" que limpa a URL e deleta o arquivo
- **Texto informativo:** _"Tamanho ideal: 200×60px. Formatos aceitos: PNG, SVG, JPG ou WebP. Máximo 2MB. Fundo transparente recomendado."_

#### 3. `src/components/Footer.tsx` — Exibir logo do branding

Consumir `useBranding()` e renderizar `<img>` quando `branding.logo_url` existir. Exibir `branding.platform_name` e `branding.footer_text` quando disponíveis, em vez dos valores fixos "Sua Base".

### Resumo

| Arquivo | Mudança |
|---|---|
| Migração SQL | Bucket `logos` + políticas de Storage |
| `src/pages/app/BrandingSettings.tsx` | Campo de upload com preview, remoção e dica de tamanho ideal (200×60px) |
| `src/components/Footer.tsx` | Consumir `useBranding()` para logo e textos dinâmicos |

### Resultado

- Upload direto de imagem na página de Branding com orientação clara sobre tamanho ideal
- Logo aparece automaticamente no header (já funciona) e no footer (será adicionado)
- Cada tenant tem sua logo isolada no bucket

