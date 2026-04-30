# Project Finance

Project Finance e um app de fluxo de caixa pessoal com login simples, convites por workspace e dashboard mensal real. A stack prioriza velocidade de iteracao no frontend e regras de acesso fortes no banco, sem Edge Functions e sem camadas desnecessarias.

## Estado atual

- v0.2.4 validada: sessao blindada entre Supabase, Zustand e React Router com a rota `/handoff`.
- shell de auth refinada: linguagem mais humana, superficie mais limpa e fluxo sem estados intermediarios falsos.
- v0.2 ativa: rota `/admin` com emissao e revogacao de convites.
- v0.2.5 em foco: UX mobile-first em `/admin`, `/login` e `/invite/:code`.

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
- `/admin`

## Principios da arquitetura

- Isolamento rigoroso por `workspace_id`.
- Regras de acesso centralizadas no Postgres via RLS, triggers e RPCs.
- Estado global restrito a `session`, `role` e `workspaceId`.
- Fluxo de convite concentrado na RPC `public.claim_invite(text)`.
- Competencia e data corrente baseadas em `America/Sao_Paulo` para evitar drift entre navegacao e labels.

## Ambiente

O frontend usa apenas as variaveis nativas do Vite:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

Arquivos relacionados:

- `.env.example`: placeholders versionados.
- `.env`: configuracao local ignorada pelo git.

## Rodando localmente

1. Rode `npm install`.
2. Crie o `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` reais.
3. Aplique as migrations em `supabase/migrations/` no projeto Supabase, incluindo foundation, snapshots de historico e ajuste de RLS para convites isolados.
4. Confirme que `Confirm email` esta desativado em `Authentication`.
5. Rode `npm run dev`.

## Validacao rapida da v0.2.5

1. Abra `/login` e confirme que, no celular, o formulario aparece antes do bloco institucional.
2. Abra `/invite/:code` e confirme a mesma prioridade: acao primeiro, apoio depois.
3. Entre em `/admin` no celular e confirme que o bloco `Criar convite` aparece antes das metricas e do historico.
4. Gere um convite e valide que o historico mobile mostra cards sanfonados com status e destino no estado fechado.
5. Expanda um convite no mobile e confirme validade, identificador de ativacao e acao de `Revogar`.
6. Confirme contraste de inputs e botoes no Dark Mode em `/login`, `/invite/:code` e `/admin`.

## Validacao rapida da v0.2.1

1. Entre em `/admin` com uma conta `admin`.
2. Gere um convite em `Novo Workspace Isolado` informando um nome valido.
3. Gere um convite em `Membro do meu espaco`.
4. Confirme que ambos aparecem no historico com tipo e role coerentes.
5. Revogue um convite isolado ainda `pending` e confirme que ele permanece no historico.
6. Ative um convite isolado com conta nova e confirme a criacao do workspace com o nome informado.

## Validacao rapida da v0.1

1. Entre em `/login` com uma conta existente.
2. Teste `/invite/:code` com uma conta nova.
3. Teste `/invite/:code` ja autenticado.
4. Confirme o redirecionamento final para `/dashboard`.
5. Confirme que `Sair` limpa a sessao.

## O que a migracao foundation cria

O arquivo `20260426130000_fase0_foundation.sql` recria a base inicial do dominio com:

- tipos `app_role`, `category_scope`, `transaction_type` e `invite_status`
- tabelas `workspaces`, `user_roles`, `categories`, `transactions` e `invites`
- schema privado `app_private` para helpers sensiveis
- RLS habilitada nas tabelas expostas em `public`
- RPC `public.claim_invite(text)`
- bootstrap do primeiro vinculo do workspace como `admin`
- seed automatica de categorias padrao

Importante: essa migracao e destrutiva para os dados dessas tabelas. Use em ambiente de desenvolvimento ou em um projeto ainda vazio.

## Scripts uteis

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Roadmap

### v0.2

- rota `/admin`
- rota `/handoff` para transicao segura entre login, convite e logout
- criacao de convites com codigo no formato `FIN-AAAA-XXXX`
- opcao entre membro do workspace atual e novo workspace isolado
- revogacao com historico preservado
- fluxo completo admin -> convite -> ativacao -> dashboard
- reestruturacao mobile-first em `/admin`, `/login` e `/invite/:code`

### v0.3

- aprofundar o fluxo financeiro
- ampliar operacoes e acompanhamento do caixa
