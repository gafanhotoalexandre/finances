# QA Guide

Este guia reúne os roteiros rápidos de validação manual por release. Use-o como referência durante regressão funcional, smoke tests e validações antes de deploy.

## Validação rápida da v0.5.1

1. Abra `/dashboard` no mobile, toque no avatar de perfil e confirme que o dialog abre sem disparar o teclado automaticamente.
2. No mesmo dialog, salve um apelido, feche e reabra a tela para confirmar persistência local via Zustand persist.
3. Em `/dashboard`, filtre por `Cartão de Crédito` e confirme a badge `Total da fatura: R$ XXX,XX` com a soma das saídas em `credit_card` no mês atual.
4. Ainda em `/dashboard`, confira um lançamento do Cofre e valide que ele parece especial/trancado, não desabilitado, mantendo boa legibilidade em light e dark mode.
5. Abra qualquer `Select` importante do sistema, especialmente o filtro de meio de pagamento e seletores dos formulários, e confirme a nova paleta `glass-card` no conteúdo e nos itens.
6. Rode `npm run typecheck` e `npm run lint`.

## Validação rápida da v0.5.0

1. Aplique a migration `supabase/migrations/20260503170000_admin_invites_feed_rpc.sql` no banco antes de abrir `/admin`.
2. Abra `/dashboard` no celular e confirme top bar compacta, bottom nav fixa e FAB acima da navegação inferior.
3. Toque no avatar/perfil e confirme que o dialog concentra apelido local, contexto da sessão e ação de logout.
4. Ainda em `/dashboard`, use `Exportar CSV` para baixar o mês atual e o histórico completo, confirmando os dois arquivos.
5. Abra `/reservas` no celular e confirme as abas `Ativas` e `Concluídas`, com cards mais compactos e sem poluição visual.
6. Entre em `/admin` com vários convites e confirme que o histórico deixa de truncar em 5 itens.
7. Rode `npm run typecheck`, `npm run lint` e `npm run build`.

## Validação rápida da v0.4.0

1. Entre em `/reservas` com um workspace autenticado.
2. Crie uma reserva com apenas `nome` e confirme que o card nasce com `R$ 0,00`, sem meta e sem histórico.
3. Crie outra reserva com `nome` e `meta`, e confirme que o card mostra `targetAmount`, barra de progresso e valor restante.
4. Dentro do card, use `Guardar dinheiro` com `amount`, `occurredOn` e `description`, e confirme o feedback de sucesso.
5. Reabra `/dashboard` no mesmo workspace e confirme que o aporte virou uma saída real na categoria de reserva.
6. Volte para `/reservas` e confirme que `currentAmount`, `lastEntryOn` e o progresso foram atualizados após a revalidação.

## Validação rápida da v0.3.0

1. Entre em `/dashboard` com um workspace que tenha transações em meses anteriores e no mês atual.
2. Confirme que `Saldo Anterior` mostra a soma acumulada de todas as transações antes do primeiro dia do mês visualizado.
3. Confirme que `Entradas` e `Saidas` mostram apenas os movimentos do mês aberto na URL.
4. Confirme que `Caixa Atual` é igual a `Saldo Anterior + Entradas - Saidas`.
5. Navegue entre meses com e sem movimentos e valide que o card destacado continua contando a história cronológica correta.
6. Confirme que a lista `Lancamentos do mes` continua exibindo apenas as transações da competência selecionada.

## Validação rápida da v0.3.1

1. Aplique a nova migration de `payment_method` em `supabase/migrations/20260430120000_transactions_payment_method.sql`.
2. Entre em `/dashboard` e crie ao menos um lançamento em cada meio de pagamento: `credit_card`, `debit`, `pix` e `cash`.
3. Confirme que a listagem mensal mostra um badge visual para o meio de pagamento sem alterar a ordem nem a leitura do lançamento.
4. Use o filtro `Todos os meios` e troque para um método específico, confirmando que o recorte acontece apenas na lista do mês aberto.
5. Crie um lançamento com repetição maior que `1` e confirme que todas as parcelas futuras herdam o mesmo `payment_method`.

## Validação rápida da v0.3.2

1. Entre em `/dashboard` e clique em qualquer card de lançamento, confirmando que a edição abre no painel lateral do desktop e no Drawer do mobile com os campos preenchidos.
2. Edite um lançamento simples e confirme que `description`, `amount`, `transactionType`, `paymentMethod`, `categoryId` e `occurredOn` persistem corretamente após salvar.
3. Edite um lançamento recorrente e confirme que o app intercepta com as opções `Apenas este lançamento` e `Este e os futuros`.
4. No modo `Este e os futuros`, altere descrição, valor, tipo, categoria e meio de pagamento, e confirme que as parcelas futuras recebem a mudança preservando a data original de cada uma.
5. Crie uma recorrência com repetição maior que `1` e confirme que a descrição é numerada automaticamente como `(1/n)`, `(2/n)`, `(3/n)`...
6. Faça um create com um `transactionType` e `paymentMethod` diferentes do padrão e confirme que o próximo formulário novo já reaproveita esses valores apenas depois do save bem-sucedido.
7. Revalide que `Saldo Anterior`, `Entradas`, `Saidas` e `Caixa Atual` continuam com a mesma matemática cronológica de v0.3.0.

## Validação rápida da v0.2.5

1. Abra `/login` e confirme que, no celular, o formulário aparece antes do bloco institucional.
2. Abra `/invite/:code` e confirme a mesma prioridade: ação primeiro, apoio depois.
3. Entre em `/admin` no celular e confirme que o bloco `Criar convite` aparece antes das métricas e do histórico.
4. Gere um convite e valide que o histórico mobile mostra cards sanfonados com status e destino no estado fechado.
5. Expanda um convite no mobile e confirme validade, identificador de ativação e ação de `Revogar`.
6. Confirme contraste de inputs e botões no Dark Mode em `/login`, `/invite/:code` e `/admin`.

## Validação rápida da v0.2.1

1. Entre em `/admin` com uma conta `admin`.
2. Gere um convite em `Novo Workspace Isolado` informando um nome válido.
3. Gere um convite em `Membro do meu espaco`.
4. Confirme que ambos aparecem no histórico com tipo e role coerentes.
5. Revogue um convite isolado ainda `pending` e confirme que ele permanece no histórico.
6. Ative um convite isolado com conta nova e confirme a criação do workspace com o nome informado.

## Validação rápida da v0.1

1. Entre em `/login` com uma conta existente.
2. Teste `/invite/:code` com uma conta nova.
3. Teste `/invite/:code` já autenticado.
4. Confirme o redirecionamento final para `/dashboard`.
5. Confirme que `Sair` limpa a sessão.