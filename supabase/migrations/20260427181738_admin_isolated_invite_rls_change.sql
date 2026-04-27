begin;

drop policy if exists invites_select_admin on public.invites;
drop policy if exists invites_insert_admin on public.invites;
drop policy if exists invites_update_admin on public.invites;

create policy invites_select_admin
on public.invites
for select
to authenticated
using (
	(select auth.uid()) is not null
	and (select app_private.current_app_role()) = 'admin'
	and (
		workspace_id = (select app_private.current_workspace_id())
		or (
			workspace_id is null
			and created_by = (select auth.uid())
		)
	)
);

create policy invites_insert_admin
on public.invites
for insert
to authenticated
with check (
	(select auth.uid()) is not null
	and (select app_private.current_app_role()) = 'admin'
	and (
		workspace_id = (select app_private.current_workspace_id())
		or (
			workspace_id is null
			and created_by = (select auth.uid())
		)
	)
);

create policy invites_update_admin
on public.invites
for update
to authenticated
using (
	(select auth.uid()) is not null
	and (select app_private.current_app_role()) = 'admin'
	and (
		workspace_id = (select app_private.current_workspace_id())
		or (
			workspace_id is null
			and created_by = (select auth.uid())
		)
	)
)
with check (
	(select auth.uid()) is not null
	and (select app_private.current_app_role()) = 'admin'
	and (
		workspace_id = (select app_private.current_workspace_id())
		or (
			workspace_id is null
			and created_by = (select auth.uid())
		)
	)
);

commit;
