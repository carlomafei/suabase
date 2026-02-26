

## Plano: Rebrand completo "Sua Base" → "Taqt" + Logo na landing page

### Resumo
Copiar a logo enviada para o projeto, substituir todas as referências "Sua Base" pelo nome "Taqt", exibir a logo na landing page/auth/navbar/footer, e corrigir o bug de RLS que impede salvar branding.

### Implementação

**1. Migration SQL** — Adicionar política RLS UPDATE na tabela `tenants`
```sql
CREATE POLICY "Owners and admins can update tenant"
  ON public.tenants FOR UPDATE
  USING (has_tenant_role_or_above(auth.uid(), id, 'admin'))
  WITH CHECK (has_tenant_role_or_above(auth.uid(), id, 'admin'));
```

**2. Copiar logo** para `src/assets/logo-taqt.png`

**3. Arquivos a alterar:**

| Arquivo | Mudança |
|---------|---------|
| `index.html` | Trocar títulos/meta de "Sua Base" → "Taqt" |
| `src/hooks/useBranding.ts` | Default `platform_name: "Taqt"`, default `logo_url` vazio; retornar defaults quando `tenantId` é null |
| `src/components/Navbar.tsx` | Importar logo estática, usar como fallback quando não há branding |
| `src/components/Footer.tsx` | Mesmo: logo estática como fallback, trocar "Sua Base" |
| `src/components/AppLayout.tsx` | Trocar fallback "Sua Base" → "Taqt" |
| `src/pages/Auth.tsx` | Remover ícone Database, usar logo importada, trocar textos "Sua Base"/"Construa sua base" |
| `src/components/HeroSection.tsx` | Trocar "Construa sua base" e "Seus dados, sua base" por textos genéricos Taqt |
| `src/components/SolutionSection.tsx` | Trocar "o Sua Base" → "o Taqt" |
| `src/components/CTASection.tsx` | Trocar "sua base" → texto atualizado |
| `src/pages/app/BrandingSettings.tsx` | Trocar "Sua Base" → "Taqt" na label do switch |

**4. Resultado esperado:**
- Logo Taqt aparece na landing page, auth, navbar e footer sem precisar de login
- Na área logada, branding do tenant prevalece (se configurado)
- Salvar branding funciona de verdade (RLS corrigido)

