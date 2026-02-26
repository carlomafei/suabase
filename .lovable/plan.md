
## Diagnóstico
- Não parece ser problema de plano.
- O upload está funcionando e a gravação no backend também (PATCH 204 com `settings.logo_url` preenchido).
- A causa provável é sincronização de estado no front-end: `useBranding` mantém estado local por componente, então `BrandingSettings` atualiza sua própria instância, mas `AppLayout`/`Navbar`/`Footer` podem continuar com o valor antigo até refetch ou reload.

## Plano de implementação

1. Refatorar `useBranding` para fonte de verdade compartilhada (React Query), usando chave por tenant (ex.: `["branding", tenantId]`).
2. Trocar o `saveBranding` para mutation que:
   - atualiza cache imediatamente (`setQueryData`) e
   - invalida/refaz fetch da query de branding.
3. Ajustar `BrandingSettings` para manter upload/remoção chamando `saveBranding(updatedForm)` e depender da atualização global do cache (não só estado local).
4. Garantir que `AppLayout`, `Footer` e `Navbar` continuem lendo via `useBranding` e passem a refletir atualização instantânea sem reload.
5. Adicionar proteção visual de carregamento para evitar fallback “Sua Base” aparecer enquanto branding ainda está sendo carregado.

## Detalhes técnicos
- Arquivos envolvidos:
  - `src/hooks/useBranding.ts` (refactor para query/mutation compartilhadas)
  - `src/pages/app/BrandingSettings.tsx` (integração com fluxo novo)
  - `src/components/AppLayout.tsx`, `src/components/Footer.tsx`, `src/components/Navbar.tsx` (consumo do estado já sincronizado)
- Sem mudança de banco de dados.
- Sem bloqueio por plano para esse fluxo na implementação atual (`isStarterOrFree = false`).

## Validação
1. Teste ponta a ponta: em `/app/settings` > Branding, fazer upload e confirmar que logo aparece imediatamente no header/footer/navbar sem atualizar a página.
2. Remover logo e confirmar retorno imediato do texto.
3. Recarregar página e confirmar persistência correta da logo.
