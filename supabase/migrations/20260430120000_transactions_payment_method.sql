begin;

do $$
begin
    if not exists (
        select 1
        from pg_type type
        join pg_namespace namespace on namespace.oid = type.typnamespace
        where type.typname = 'payment_method'
          and namespace.nspname = 'public'
    ) then
        create type public.payment_method as enum ('credit_card', 'debit', 'pix', 'cash');
    end if;
end;
$$;

alter table public.transactions
    add column if not exists payment_method public.payment_method;

alter table public.transactions
    alter column payment_method set default 'cash';

update public.transactions
set payment_method = 'cash'
where payment_method is null;

alter table public.transactions
    alter column payment_method set not null;

create index if not exists idx_transactions_workspace_payment_method
    on public.transactions (workspace_id, payment_method);

commit;