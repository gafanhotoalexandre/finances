# Project Finance

Project Finance é um app de fluxo de caixa pessoal com login simples, convites por workspace, dashboard mensal real e um cofre de reservas separado do ledger principal. A stack prioriza velocidade de iteração no frontend e regras de acesso fortes no banco, sem Edge Functions e sem camadas desnecessárias.

## Estado atual

- v0.5.1 entregue: preferências locais saíram do `app-layout` e passaram a usar store persistido com Zustand.
- Dashboard agora destaca `Total da fatura` ao filtrar `Cartão de Crédito`, eliminando soma manual em mobile e desktop.
- Dialog de perfil deixa de forçar teclado no mobile e os `Selects` voltam a respeitar a identidade visual `glass-card`.
- Lançamentos de aporte do Cofre no dashboard agora parecem protegidos/especiais, não elementos desativados.
- Os roteiros de validação manual foram extraídos para `QA_GUIDE.md`, mantendo o README mais enxuto.

## Stack

- React 19
- Vite 7
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui
- React Router v7 em Data Mode
- Zustand
- Supabase Auth + Postgres

## Rotas ativas

- `/login`
- `/handoff`
- `/invite/:code`
- `/dashboard`
- `/reservas`
- `/admin`

## Princípios da arquitetura

- Isolamento rigoroso por `workspace_id`.
- Regras de acesso centralizadas no Postgres via RLS, triggers e RPCs.
- Estado global restrito a `session`, `role` e `workspaceId`.
- Fluxo de convite concentrado na RPC `public.claim_invite(text)`.
- Competência e data corrente baseadas em `America/Sao_Paulo` para evitar drift entre navegação e labels.

## Ambiente

O frontend usa apenas as variáveis nativas do Vite:
```bash
VITE_SUPABASE_URL=[https://your-project-ref.supabase.co](https://your-project-ref.supabase.co)
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

Arquivos relacionados:

- `.env.example`: placeholders versionados.
- `.env`: configuração local ignorada pelo git.
- `QA_GUIDE.md`: roteiros de validação manual por release.

## Rodando localmente

1. Rode `npm install`.
2. Crie o `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` reais.
3. Aplique as migrations em `supabase/migrations/` no projeto Supabase, incluindo foundation, payment methods, snapshots de histórico, o módulo `20260502162824_v040_reserves_module.sql`, os ajustes de RLS para convites isolados e `20260503170000_admin_invites_feed_rpc.sql`.
4. Confirme que `Confirm email` está desativado em `Authentication`.
5. Rode `npm run dev`.

## QA

Os roteiros rápidos de validação manual agora ficam em `QA_GUIDE.md`, incluindo as versões históricas e a nova checklist da `v0.5.1`.

## O que a migração foundation cria

O arquivo `20260426130000_fase0_foundation.sql` recria a base inicial do domínio com:

- tipos `app_role`, `category_scope`, `transaction_type` e `invite_status`
- tabelas `workspaces`, `user_roles`, `categories`, `transactions` e `invites`
- schema privado `app_private` para helpers sensíveis
- RLS habilitada nas tabelas expostas em `public`
- RPC `public.claim_invite(text)`
- bootstrap do primeiro vínculo do workspace como `admin`
- seed automática de categorias padrão

Importante: essa migração é destrutiva para os dados dessas tabelas. Use em ambiente de desenvolvimento ou em um projeto ainda vazio.

## Scripts úteis

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Roadmap

### v0.2

- rota `/admin`
- rota `/handoff` para transição segura entre login, convite e logout
- criação de convites com código no formato `FIN-AAAA-XXXX`
- opção entre membro do workspace atual e novo workspace isolado
- revogação com histórico preservado
- fluxo completo admin -> convite -> ativação -> dashboard
- reestruturação mobile-first em `/admin`, `/login` e `/invite/:code`

### v0.3

- discriminação de `payment_method` com `credit_card`, `debit`, `pix` e `cash`
- filtro local por meio de pagamento na lista do dashboard
- saldo anterior acumulado antes da competência aberta
- caixa atual calculado a partir do histórico + movimentos do mês
- ampliar operações e acompanhamento do caixa

### v0.4

- rota protegida `/reservas` integrada ao mesmo shell do dashboard
- criação de reservas com `name` obrigatório e `targetAmount` opcional
- cards das caixinhas com valor atual, meta, progresso e último aporte
- fluxo `Guardar dinheiro` conectado à RPC `allocate_to_reserve(...)`
- revalidação local após criar reserva e após cada novo aporte

### v0.5

- função SQL `public.get_admin_invites_feed()` para histórico administrativo sem gargalo oculto
- shell mobile com top bar mínima, bottom nav fixa e logout movido para o dialog de perfil
- apelido local por navegador para personalizar a experiência sem expandir escopo do backend
- exportação CSV do dashboard para mês atual e histórico completo
- abas de `Ativas` e `Concluídas` na página de reservas
- lazy loading para `/dashboard`, `/reservas` e `/admin`

### v0.5.1

- store persistido de preferências para apelido local do usuário
- métrica `Total da fatura` ao filtrar lançamentos por `Cartão de Crédito`
- bloqueio de autofocus no dialog de perfil em telas menores
- paleta `glass-card` aplicada ao conteúdo e aos itens do `Select`
- aportes do Cofre com visual protegido/especial no dashboard
- validação manual centralizada em `QA_GUIDE.md`
