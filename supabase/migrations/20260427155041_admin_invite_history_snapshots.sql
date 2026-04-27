begin;

alter table public.invites
	add column if not exists claimed_by_snapshot uuid references auth.users (id) on delete set null,
	add column if not exists claimed_at_snapshot timestamptz;

update public.invites
set claimed_by_snapshot = claimed_by,
	claimed_at_snapshot = claimed_at
where claimed_by is not null
  and claimed_at is not null
  and (
	  claimed_by_snapshot is null
	  or claimed_at_snapshot is null
  );

alter table public.invites
	drop constraint if exists invites_snapshot_pair_consistency;

alter table public.invites
	drop constraint if exists invites_state_consistency;

alter table public.invites
	add constraint invites_snapshot_pair_consistency check (
		(
			claimed_by_snapshot is null
			and claimed_at_snapshot is null
		)
		or (
			claimed_by_snapshot is not null
			and claimed_at_snapshot is not null
		)
	),
	add constraint invites_state_consistency check (
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
	);

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

	if new.claimed_by is not null and new.claimed_by_snapshot is null then
		new.claimed_by_snapshot := new.claimed_by;
	end if;

	if new.claimed_at is not null and new.claimed_at_snapshot is null then
		new.claimed_at_snapshot := new.claimed_at;
	end if;

	if new.status = 'revoked' and new.revoked_at is null then
		new.revoked_at := now();
	elsif new.status <> 'revoked' then
		new.revoked_at := null;
	end if;

	if new.status <> 'used' then
		if new.claimed_by is not null then
			new.claimed_by_snapshot := coalesce(new.claimed_by_snapshot, new.claimed_by);
		end if;

		if new.claimed_at is not null then
			new.claimed_at_snapshot := coalesce(new.claimed_at_snapshot, new.claimed_at);
		end if;

		new.claimed_by := null;
		new.claimed_at := null;
	end if;

	return new;
end;
$$;

commit;
