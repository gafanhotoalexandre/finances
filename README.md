# Project Finance

Project Finance e um MVP tatico de fluxo de caixa pessoal, reconstruido em cima de uma stack simples e direta: React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, React Router v7 em Data Mode, Zustand para auth/contexto e Supabase para auth + banco.

O foco do projeto e produtividade com isolamento rigoroso por `workspace_id`, sem Edge Functions e sem burocracia de arquitetura. A seguranca do dominio fica no Postgres via RLS, triggers e RPCs.

## Stack

- React 19
- Vite 7
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui
- React Router v7
- Zustand
- Supabase Auth + Postgres

## Fase Atual

Fase 0 entregue: fundacao de dados.

Fase v0.1 entregue: fundacao do frontend autenticado.

Artefatos desta fase:

- `supabase/migrations/20260426130000_fase0_foundation.sql`
- `src/lib/supabase.ts`
- `src/lib/auth.ts`
- `src/store/auth.ts`
- `src/routes/*`
- este `README.md`

Esta primeira fatia do frontend sobe:

- cliente browser do Supabase
- Zustand restrito a `session`, `role` e `workspaceId`
- React Router v7 em Data Mode
- login por e-mail e senha
- ativacao de convite em `/invite/:code`
- dashboard protegido provando hidratacao e sign out

## Variaveis de Ambiente

O frontend consome apenas as variaveis nativas do Vite:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

No Vite, essas variaveis serao acessadas como:

```ts
import.meta.env.VITE_SUPABASE_URL
import.meta.env.VITE_SUPABASE_ANON_KEY
```

Arquivos do repositorio:

- `.env.example`: placeholders versionados
- `.env`: scaffold local ignorado pelo git

Troque os placeholders do `.env` pelos valores reais do projeto Supabase antes de testar. Nao commite chaves reais no repositorio. Na Vercel, basta cadastrar essas variaveis com o prefixo `VITE_`.

## Como Testar a v0.1

1. Rode `npm install`.
2. Preencha o `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` reais.
3. Garanta que o SQL da Fase 0 ja foi aplicado no projeto Supabase.
4. Confirme que `Confirm email` continua desativado em `Authentication` no Supabase.
5. Rode `npm run dev`.
6. Teste `/login` com uma conta existente.
7. Teste `/invite/:code` em dois modos: conta nova e sessao ja autenticada.
8. Confirme que o fluxo bem-sucedido leva para `/dashboard` e que o botao `Sair` limpa a sessao.

## O Que o SQL da Fase 0 Cria

O script `20260426130000_fase0_foundation.sql` faz teardown e recriacao controlada dos objetos centrais do sistema:

- tipos `app_role`, `category_scope`, `transaction_type` e `invite_status`
- tabelas `workspaces`, `user_roles`, `categories`, `transactions` e `invites`
- schema privado `app_private` para helpers e triggers sensiveis
- RLS rigorosa em todas as tabelas expostas em `public`
- RPC `public.claim_invite(text)`
- regra de bootstrap em que o primeiro usuario vinculado ao workspace vira `admin`
- trigger para semear categorias padrao automaticamente ao primeiro vinculo do workspace

### Regras centrais do banco

- usuario autenticado sem linha em `user_roles` continua “fantasma” e nao enxerga nada
- todo acesso funcional depende do `workspace_id` retornado pelo vinculo do usuario
- `security definer` foi mantido apenas no schema privado `app_private`, seguindo a recomendacao do Supabase
- a RPC `claim_invite` roda com privilegio controlado, valida o convite e vincula o usuario ao workspace certo
- se o convite nao tiver `workspace_id`, a RPC cria um workspace novo e promove o primeiro vinculo para `admin`

## Como Rodar o Script no Painel do Supabase

1. Abra o projeto no painel do Supabase.
2. Entre em `SQL Editor`.
3. Clique em `New query`.
4. Abra o arquivo `supabase/migrations/20260426130000_fase0_foundation.sql` neste repositorio.
5. Cole o conteudo inteiro no editor SQL.
6. Execute com `Run`.

## Importante Antes de Executar

O script faz teardown dos objetos da Fase 0 antes de recria-los. Em outras palavras: ele e destrutivo para qualquer dado que ja exista nessas tabelas.

Objetos afetados:

- `public.workspaces`
- `public.user_roles`
- `public.categories`
- `public.transactions`
- `public.invites`
- functions e triggers associadas

Use este script em ambiente de desenvolvimento ou num projeto Supabase ainda vazio.

## Como Conferir se a Migracao Subiu

Depois de rodar o script, confirme no painel do Supabase:

1. `Table Editor`: as tabelas `workspaces`, `user_roles`, `categories`, `transactions` e `invites` existem.
2. `Database` -> `Functions`: a funcao `public.claim_invite` existe.
3. `Authentication` -> `Policies` ou `Database` -> `Policies`: todas as tabelas em `public` ficaram com RLS habilitada.
4. `Database` -> `Triggers`: os gatilhos de `updated_at`, normalizacao de convite e seed de categorias foram criados.

## Smoke Test Manual Opcional

Se quiser deixar um convite de bootstrap pronto para a primeira conta, rode depois da migracao:

```sql
insert into public.invites (code, workspace_name)
values ('FIN-BOOT-2026', 'Workspace Alexandre');
```

Esse convite nasce sem `workspace_id`. Quando um usuario autenticado chamar `public.claim_invite('FIN-BOOT-2026')`, o banco ira:

1. criar o workspace
2. vincular o usuario em `user_roles`
3. promover esse primeiro vinculo para `admin`
4. semear as categorias padrao
5. marcar o convite como `used`

## Observacoes de Teste

- `claim_invite` depende de `auth.uid()`, entao ela precisa ser chamada por um usuario autenticado.
- Rodar `select public.claim_invite('FIN-BOOT-2026');` diretamente no SQL Editor como `postgres` nao simula um usuario autenticado do Supabase Auth.
- O teste real dessa RPC deve ser feito a partir de um cliente autenticado, API docs autenticadas ou frontend da Fase v0.1.
- O fluxo de cadastro em `/invite/:code` assume `Confirm email` desligado. Se essa flag estiver ligada, o `signUp` nao devolve sessao imediata e a ativacao quebra.

## Roadmap

### Fase 0

- schema e seguranca no banco
- convite com bootstrap automatico de admin
- documentacao do setup

### Fase v0.1

- cliente Supabase no Vite
- Zustand para sessao, role e `workspace_id`
- React Router v7 em Data Mode
- login + ativacao de convite
- dashboard Blueprint com drawer mobile-first

Status: entregue.

### Fase v0.2

- rota `/admin`
- geracao e revogacao de convites
- fluxo completo admin -> convite -> ativacao -> dashboard
