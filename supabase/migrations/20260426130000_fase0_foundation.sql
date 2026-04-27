begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;

drop function if exists public.claim_invite(text);
drop function if exists app_private.tg_seed_default_categories();
drop function if exists app_private.seed_default_categories(uuid);
drop function if exists app_private.current_app_role();
drop function if exists app_private.current_workspace_id();
drop function if exists app_private.tg_stamp_transaction_actor();
drop function if exists app_private.tg_ensure_transaction_category();
drop function if exists app_private.tg_normalize_invite();
drop function if exists app_private.tg_set_updated_at();

drop table if exists public.transactions cascade;
drop table if exists public.categories cascade;
drop table if exists public.invites cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.workspaces cascade;

drop type if exists public.invite_status cascade;
drop type if exists public.transaction_type cascade;
drop type if exists public.category_scope cascade;
drop type if exists public.app_role cascade;

create type public.app_role as enum ('admin', 'user');
create type public.category_scope as enum ('in', 'out', 'both');
create type public.transaction_type as enum ('in', 'out');
create type public.invite_status as enum ('pending', 'used', 'expired', 'revoked');

create table public.workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint workspaces_name_length check (char_length(trim(name)) between 3 and 80)
);

create table public.user_roles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    role public.app_role not null default 'user',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_user_roles_workspace_id on public.user_roles (workspace_id);

create table public.categories (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    name text not null,
    scope public.category_scope not null default 'both',
    is_system boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint categories_name_length check (char_length(trim(name)) between 2 and 60)
);

create unique index idx_categories_workspace_name_unique
    on public.categories (workspace_id, lower(name));

create index idx_categories_workspace_scope
    on public.categories (workspace_id, scope);

create table public.transactions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    category_id uuid references public.categories (id) on delete set null,
    description text not null,
    transaction_type public.transaction_type not null,
    amount numeric(12, 2) not null,
    occurred_on date not null,
    notes text,
    recurrence_group_id text,
    created_by uuid references auth.users (id) on delete set null,
    updated_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint transactions_description_length check (char_length(trim(description)) between 3 and 160),
    constraint transactions_amount_positive check (amount > 0),
    constraint transactions_notes_length check (notes is null or char_length(notes) <= 1000),
    constraint transactions_recurrence_group_id_length check (
        recurrence_group_id is null or char_length(trim(recurrence_group_id)) between 3 and 80
    )
);

create index idx_transactions_workspace_occurred_on
    on public.transactions (workspace_id, occurred_on desc);

create index idx_transactions_workspace_type
    on public.transactions (workspace_id, transaction_type);

create index idx_transactions_recurrence_group_id
    on public.transactions (recurrence_group_id)
    where recurrence_group_id is not null;

create table public.invites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references public.workspaces (id) on delete cascade,
    code text not null,
    workspace_name text,
    requested_role public.app_role not null default 'user',
    status public.invite_status not null default 'pending',
    created_by uuid references auth.users (id) on delete set null,
    claimed_by uuid references auth.users (id) on delete set null,
    expires_at timestamptz not null default (now() + interval '14 days'),
    claimed_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint invites_code_length check (char_length(trim(code)) between 6 and 64),
    constraint invites_workspace_name_length check (
        workspace_name is null or char_length(trim(workspace_name)) between 3 and 80
    ),
    constraint invites_expires_after_creation check (expires_at > created_at),
    constraint invites_state_consistency check (
        (
            status = 'used'
            and claimed_by is not null
            and claimed_at is not null
            and revoked_at is null
        )
        or (
            status = 'revoked'
            and revoked_at is not null
            and claimed_by is null
            and claimed_at is null
        )
        or (
            status in ('pending', 'expired')
            and claimed_by is null
            and claimed_at is null
            and revoked_at is null
        )
    )
);

create unique index idx_invites_code_unique on public.invites (code);

create index idx_invites_workspace_status
    on public.invites (workspace_id, status, expires_at desc);

create or replace function app_private.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create or replace function app_private.tg_normalize_invite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.code := upper(trim(new.code));

    if new.workspace_name is not null then
        new.workspace_name := nullif(trim(new.workspace_name), '');
    end if;

    if new.status = 'revoked' and new.revoked_at is null then
        new.revoked_at := now();
    elsif new.status <> 'revoked' then
        new.revoked_at := null;
    end if;

    if new.status <> 'used' then
        new.claimed_by := null;
        new.claimed_at := null;
    end if;

    return new;
end;
$$;

create or replace function app_private.tg_ensure_transaction_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.category_id is null then
        return new;
    end if;

    if not exists (
        select 1
        from public.categories
        where id = new.category_id
          and workspace_id = new.workspace_id
    ) then
        raise exception 'CATEGORY_WORKSPACE_MISMATCH';
    end if;

    return new;
end;
$$;

create or replace function app_private.tg_stamp_transaction_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
begin
    if tg_op = 'INSERT' then
        if v_user_id is not null then
            new.created_by := v_user_id;
            new.updated_by := v_user_id;
        end if;
        return new;
    end if;

    new.created_by := old.created_by;

    if v_user_id is not null then
        new.updated_by := v_user_id;
    else
        new.updated_by := old.updated_by;
    end if;

    return new;
end;
$$;

create or replace function app_private.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select ur.workspace_id
    from public.user_roles as ur
    where ur.user_id = auth.uid()
    limit 1;
$$;

create or replace function app_private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
    select ur.role
    from public.user_roles as ur
    where ur.user_id = auth.uid()
    limit 1;
$$;

create or replace function app_private.seed_default_categories(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.categories (workspace_id, name, scope, is_system)
    values
        (p_workspace_id, 'Moradia', 'out', true),
        (p_workspace_id, 'Transporte', 'out', true),
        (p_workspace_id, 'Alimentacao', 'out', true),
        (p_workspace_id, 'Saude', 'out', true),
        (p_workspace_id, 'Assinaturas', 'out', true),
        (p_workspace_id, 'Lazer', 'out', true),
        (p_workspace_id, 'Receitas Fixas', 'in', true),
        (p_workspace_id, 'Receitas Variaveis', 'in', true),
        (p_workspace_id, 'Reserva', 'both', true)
    on conflict do nothing;
end;
$$;

create or replace function app_private.tg_seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform app_private.seed_default_categories(new.workspace_id);
    return new;
end;
$$;

create or replace function public.claim_invite(p_code text)
returns table (
    workspace_id uuid,
    assigned_role public.app_role,
    invite_id uuid,
    created_workspace boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_now timestamptz := now();
    v_code text;
    v_invite public.invites%rowtype;
    v_workspace_id uuid;
    v_member_count integer;
    v_created_workspace boolean := false;
    v_assigned_role public.app_role;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'AUTHENTICATION_REQUIRED';
    end if;

    if exists (
        select 1
        from public.user_roles
        where user_id = v_user_id
    ) then
        raise exception 'USER_ALREADY_LINKED_TO_WORKSPACE';
    end if;

    v_code := upper(trim(p_code));

    if v_code is null or v_code = '' then
        raise exception 'INVITE_CODE_REQUIRED';
    end if;

    select *
    into v_invite
    from public.invites
    where code = v_code
    for update;

    if not found then
        raise exception 'INVITE_NOT_FOUND';
    end if;

    if v_invite.status = 'used' or v_invite.claimed_by is not null then
        raise exception 'INVITE_ALREADY_USED';
    end if;

    if v_invite.status = 'revoked' then
        raise exception 'INVITE_REVOKED';
    end if;

    if v_invite.status = 'expired' or v_invite.expires_at <= v_now then
        update public.invites
        set status = 'expired',
            updated_at = v_now
        where id = v_invite.id
          and status = 'pending';

        raise exception 'INVITE_EXPIRED';
    end if;

    if v_invite.status <> 'pending' then
        raise exception 'INVITE_NOT_PENDING';
    end if;

    if v_invite.workspace_id is null then
        insert into public.workspaces (name, created_by)
        values (
            coalesce(nullif(trim(v_invite.workspace_name), ''), 'Finance Workspace'),
            v_user_id
        )
        returning id into v_workspace_id;

        v_created_workspace := true;
    else
        v_workspace_id := v_invite.workspace_id;
    end if;

    perform 1
    from public.workspaces
    where id = v_workspace_id
    for update;

    if not found then
        raise exception 'INVITE_WORKSPACE_NOT_FOUND';
    end if;

    select count(*)
    into v_member_count
    from public.user_roles
        where public.user_roles.workspace_id = v_workspace_id;

    if v_member_count = 0 then
        v_assigned_role := 'admin';
    else
        v_assigned_role := v_invite.requested_role;
    end if;

    insert into public.user_roles (user_id, workspace_id, role)
    values (v_user_id, v_workspace_id, v_assigned_role);

    update public.invites
    set workspace_id = v_workspace_id,
        status = 'used',
        claimed_by = v_user_id,
        claimed_at = v_now,
        updated_at = v_now
    where id = v_invite.id;

    return query
    select v_workspace_id, v_assigned_role, v_invite.id, v_created_workspace;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function app_private.tg_set_updated_at();

create trigger user_roles_set_updated_at
before update on public.user_roles
for each row
execute function app_private.tg_set_updated_at();

create trigger user_roles_seed_default_categories
after insert on public.user_roles
for each row
execute function app_private.tg_seed_default_categories();

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function app_private.tg_set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function app_private.tg_set_updated_at();

create trigger transactions_ensure_category
before insert or update on public.transactions
for each row
execute function app_private.tg_ensure_transaction_category();

create trigger transactions_stamp_actor
before insert or update on public.transactions
for each row
execute function app_private.tg_stamp_transaction_actor();

create trigger invites_set_updated_at
before update on public.invites
for each row
execute function app_private.tg_set_updated_at();

create trigger invites_normalize
before insert or update on public.invites
for each row
execute function app_private.tg_normalize_invite();

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant usage on type public.app_role to authenticated;
grant usage on type public.category_scope to authenticated;
grant usage on type public.transaction_type to authenticated;
grant usage on type public.invite_status to authenticated;

grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.invites to authenticated;

revoke all on public.workspaces from anon;
revoke all on public.user_roles from anon;
revoke all on public.categories from anon;
revoke all on public.transactions from anon;
revoke all on public.invites from anon;

revoke all on all functions in schema app_private from public;
revoke all on all functions in schema app_private from anon;
revoke all on all functions in schema app_private from authenticated;

revoke all on function public.claim_invite(text) from public;
revoke all on function public.claim_invite(text) from anon;
revoke all on function public.claim_invite(text) from authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.current_workspace_id() to authenticated;
grant execute on function app_private.current_app_role() to authenticated;

alter table public.workspaces enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.invites enable row level security;

create policy workspaces_select_current
on public.workspaces
for select
to authenticated
using (
    (select auth.uid()) is not null
    and id = (select app_private.current_workspace_id())
);

create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (
    (select auth.uid()) is not null
    and id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
)
with check (
    id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy user_roles_select_self_or_admin
on public.user_roles
for select
to authenticated
using (
    (select auth.uid()) is not null
    and (
        user_id = (select auth.uid())
        or (
            workspace_id = (select app_private.current_workspace_id())
            and (select app_private.current_app_role()) = 'admin'
        )
    )
);

create policy categories_select_workspace
on public.categories
for select
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy categories_insert_admin
on public.categories
for insert
to authenticated
with check (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy categories_update_admin
on public.categories
for update
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
)
with check (
    workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy categories_delete_admin
on public.categories
for delete
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy transactions_select_workspace
on public.transactions
for select
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy transactions_insert_workspace
on public.transactions
for insert
to authenticated
with check (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy transactions_update_workspace
on public.transactions
for update
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
)
with check (
    workspace_id = (select app_private.current_workspace_id())
);

create policy transactions_delete_workspace
on public.transactions
for delete
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
);

create policy invites_select_admin
on public.invites
for select
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy invites_insert_admin
on public.invites
for insert
to authenticated
with check (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy invites_update_admin
on public.invites
for update
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
)
with check (
    workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

create policy invites_delete_admin
on public.invites
for delete
to authenticated
using (
    (select auth.uid()) is not null
    and workspace_id = (select app_private.current_workspace_id())
    and (select app_private.current_app_role()) = 'admin'
);

commit;