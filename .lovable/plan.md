

## Painel lateral de detalhes do pedido (Orders)

### Objetivo
Ao clicar em um pedido na tabela, abrir um painel no lado direito mostrando informações do cliente com dados de duas fontes:
- **Data Broker (Deskdata)**: WhatsApp e e-mail (campos `whatsapp` e `email` da tabela `contacts`)
- **Bling**: Nome, CPF/CNPJ, telefone e **endereço** (buscado do cadastro de Clientes/Fornecedores)

### Problema atual
O endereço do cliente não é coletado durante a sincronização. A função `fetchBlingContact` em `bling-sync` já busca `/contatos/{id}` mas ignora o campo `endereco`.

### Plano de implementação

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | **`supabase/functions/bling-sync/index.ts`** | Extrair `endereco` (geral + número + complemento + bairro + cep + municipio + uf) do retorno de `fetchBlingContact` e salvar em `contacts.metadata.endereco` |
| 2 | **`src/pages/app/Orders.tsx`** | Adicionar estado `selectedOrder`, ao clicar numa linha abrir painel lateral direito (Sheet ou div fixa) mostrando: nome, CPF, WhatsApp, e-mail, endereço completo, itens do pedido |

### Detalhes técnicos

**Bling sync — extração de endereço:**
O endpoint `GET /contatos/{id}` retorna o objeto `endereco` com campos: `endereco`, `numero`, `complemento`, `bairro`, `cep`, `municipio`, `uf`. Serão salvos em `contacts.metadata.endereco`.

**Painel lateral (Orders.tsx):**
- Layout: tabela ocupa ~65% da largura, painel lateral ~35% (aparece ao selecionar pedido)
- Seções do painel:
  - **Cliente**: nome, CPF/CNPJ (do Bling)
  - **Contato (Data Broker)**: WhatsApp (com botão de abrir wa.me), e-mail
  - **Endereço**: rua, número, complemento, bairro, cidade-UF, CEP (de `contacts.metadata.endereco`)
  - **Itens do pedido**: lista de produtos com quantidade e valor
- Query do contato: ao selecionar pedido, buscar `contacts` pelo `contact_id` para obter `whatsapp`, `email`, `metadata.endereco`
- Botão X para fechar o painel

**Nota:** Como o usuário mencionou uma imagem de referência mas ela não foi anexada, o layout será baseado nesta descrição. Se precisar ajustes visuais, podemos refinar depois.

