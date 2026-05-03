begin;

create or replace function public.get_admin_invites_feed()
returns table (
    id uuid,
    code text,
    requested_role public.app_role,
    status public.invite_status,
    expires_at timestamptz,
    created_at timestamptz,
    revoked_at timestamptz,
    claimed_at timestamptz,
    claimed_by uuid,
    claimed_at_snapshot timestamptz,
    claimed_by_snapshot uuid,
    workspace_id uuid,
    workspace_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
    select
        i.id,
        i.code,
        i.requested_role,
        i.status,
        i.expires_at,
        i.created_at,
        i.revoked_at,
        i.claimed_at,
        i.claimed_by,
        i.claimed_at_snapshot,
        i.claimed_by_snapshot,
        i.workspace_id,
        i.workspace_name
    from public.invites as i
    order by i.created_at desc;
$$;

revoke all on function public.get_admin_invites_feed() from public;
revoke all on function public.get_admin_invites_feed() from anon;
revoke all on function public.get_admin_invites_feed() from authenticated;
grant execute on function public.get_admin_invites_feed() to authenticated;

commit;