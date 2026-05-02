begin;

create table public.reserves (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    name text not null,
    target_amount numeric(12, 2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint reserves_name_length check (char_length(trim(name)) between 2 and 80),
    constraint reserves_target_amount_positive check (
        target_amount is null or target_amount > 0
    ),
    constraint reserves_id_workspace_unique unique (id, workspace_id)
);

create unique index idx_reserves_workspace_name_unique
    on public.reserves (workspace_id, lower(name));

create index idx_reserves_workspace_created_at
    on public.reserves (workspace_id, created_at desc);

create table public.reserve_entries (
    id uuid primary key default gen_random_uuid(),
    reserve_id uuid not null,
    workspace_id uuid not null,
    source_transaction_id uuid references public.transactions (id) on delete cascade,
    entry_type public.transaction_type not null default 'in',
    amount numeric(12, 2) not null,
    occurred_on date not null,
    description text not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint reserve_entries_amount_positive check (amount > 0),
    constraint reserve_entries_description_length check (
        char_length(trim(description)) between 3 and 160
    ),
    constraint reserve_entries_notes_length check (
        notes is null or char_length(notes) <= 1000
    ),
    constraint reserve_entries_reserve_workspace_fkey foreign key (reserve_id, workspace_id)
        references public.reserves (id, workspace_id)
        on delete cascade,
    constraint reserve_entries_source_transaction_unique unique (source_transaction_id)
);

create index idx_reserve_entries_workspace_reserve_occurred_on
    on public.reserve_entries (workspace_id, reserve_id, occurred_on desc, created_at desc);

create index idx_reserve_entries_workspace_type
    on public.reserve_entries (workspace_id, entry_type);

create or replace function public.get_reserves_summary()
returns table (
    reserve_id uuid,
    name text,
    target_amount numeric,
    current_amount numeric,
    remaining_amount numeric,
    last_entry_on date,
    entry_count bigint,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        r.id as reserve_id,
        r.name,
        r.target_amount,
        coalesce(
            sum(
                case
                    when re.entry_type = 'in' then re.amount
                    else -re.amount
                end
            ),
            0
        )::numeric as current_amount,
        case
            when r.target_amount is null then null
            else (
                r.target_amount
                - coalesce(
                    sum(
                        case
                            when re.entry_type = 'in' then re.amount
                            else -re.amount
                        end
                    ),
                    0
                )
            )::numeric
        end as remaining_amount,
        max(re.occurred_on) as last_entry_on,
        count(re.id)::bigint as entry_count,
        r.created_at,
        r.updated_at
    from public.reserves as r
    left join public.reserve_entries as re
        on re.reserve_id = r.id
       and re.workspace_id = r.workspace_id
    where (select auth.uid()) is not null
      and r.workspace_id = (select app_private.current_workspace_id())
    group by r.id, r.name, r.target_amount, r.created_at, r.updated_at
    order by lower(r.name), r.created_at asc;
$$;

create or replace function public.allocate_to_reserve(
    p_reserve_id uuid,
    p_amount numeric,
    p_occurred_on date,
    p_description text,
    p_payment_method public.payment_method default 'cash',
    p_category_id uuid default null,
    p_notes text default null
)
returns table (
    transaction_id uuid,
    reserve_entry_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_category_id uuid := p_category_id;
    v_description text := nullif(trim(coalesce(p_description, '')), '');
    v_notes text := nullif(trim(coalesce(p_notes, '')), '');
    v_reserve_id uuid;
    v_reserve_entry_id uuid;
    v_transaction_id uuid;
    v_workspace_id uuid;
begin
    if auth.uid() is null then
        raise exception 'AUTHENTICATION_REQUIRED';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'INVALID_AMOUNT';
    end if;

    if p_occurred_on is null then
        raise exception 'INVALID_OCCURRED_ON';
    end if;

    if v_description is null or char_length(v_description) < 3 then
        raise exception 'INVALID_DESCRIPTION';
    end if;

    if v_notes is not null and char_length(v_notes) > 1000 then
        raise exception 'INVALID_NOTES_LENGTH';
    end if;

    select app_private.current_workspace_id()
    into v_workspace_id;

    if v_workspace_id is null then
        raise exception 'WORKSPACE_CONTEXT_REQUIRED';
    end if;

    select r.id
    into v_reserve_id
    from public.reserves as r
    where r.id = p_reserve_id
      and r.workspace_id = v_workspace_id
    limit 1;

    if v_reserve_id is null then
        raise exception 'RESERVE_NOT_FOUND';
    end if;

    if v_category_id is null then
        select c.id
        into v_category_id
        from public.categories as c
        where c.workspace_id = v_workspace_id
          and lower(c.name) = 'reserva'
        order by c.is_system desc, c.id asc
        limit 1;
    end if;

    insert into public.transactions (
        workspace_id,
        category_id,
        description,
        transaction_type,
        amount,
        occurred_on,
        notes,
        payment_method
    )
    values (
        v_workspace_id,
        v_category_id,
        v_description,
        'out',
        p_amount,
        p_occurred_on,
        v_notes,
        coalesce(p_payment_method, 'cash')
    )
    returning id into v_transaction_id;

    insert into public.reserve_entries (
        reserve_id,
        workspace_id,
        source_transaction_id,
        entry_type,
        amount,
        occurred_on,
        description,
        notes
    )
    values (
        v_reserve_id,
        v_workspace_id,
        v_transaction_id,
        'in',
        p_amount,
        p_occurred_on,
        v_description,
        v_notes
    )
    returning id into v_reserve_entry_id;

    return query
    select v_transaction_id, v_reserve_entry_id;
end;
$$;

create trigger reserves_set_updated_at
before update on public.reserves
for each row
execute function app_private.tg_set_updated_at();

create trigger reserve_entries_set_updated_at
before update on public.reserve_entries
for each row
execute function app_private.tg_set_updated_at();

grant select, insert, update, delete on public.reserves to authenticated;
grant select, insert, update, delete on public.reserve_entries to authenticated;

revoke all on public.reserves from anon;
revoke all on public.reserve_entries from anon;

revoke all on function public.get_reserves_summary() from public;
revoke all on function public.get_reserves_summary() from anon;
revoke all on function public.get_reserves_summary() from authenticated;
grant execute on function public.get_reserves_summary() to authenticated;

revoke all on function public.allocate_to_reserve(uuid, numeric, date, text, public.payment_method, uuid, text) from public;
revoke all on function public.allocate_to_reserve(uuid, numeric, date, text, public.payment_method, uuid, text) from anon;
revoke all on function public.allocate_to_reserve(uuid, numeric, date, text, public.payment_method, uuid, text) from authenticated;
grant execute on function public.allocate_to_reserve(uuid, numeric, date, text, public.payment_method, uuid, text) to authenticated;

alter table public.reserves enable row level security;
alter table public.reserve_entries enable row level security;

create policy reserves_select_workspace
on public.reserves
for select
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy reserves_insert_workspace
on public.reserves
for insert
to authenticated
with check (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy reserves_update_workspace
on public.reserves
for update
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
)
with check (
    workspace_id = (select app_private.current_workspace_id())
);

create policy reserves_delete_workspace
on public.reserves
for delete
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy reserve_entries_select_workspace
on public.reserve_entries
for select
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy reserve_entries_insert_workspace
on public.reserve_entries
for insert
to authenticated
with check (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy reserve_entries_update_workspace
on public.reserve_entries
for update
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
)
with check (
    workspace_id = (select app_private.current_workspace_id())
);

create policy reserve_entries_delete_workspace
on public.reserve_entries
for delete
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

commit;