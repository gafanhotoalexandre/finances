begin;

alter table public.reserves
	add column status text not null default 'active',
	add constraint reserves_status_valid check (status in ('active', 'archived'));

drop function if exists public.get_reserves_summary();

create or replace function public.get_reserves_summary()
returns table (
	reserve_id uuid,
	name text,
	status text,
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
		r.status,
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
	group by r.id, r.name, r.status, r.target_amount, r.created_at, r.updated_at
	order by
		case when r.status = 'archived' then 1 else 0 end,
		lower(r.name),
		r.created_at asc;
$$;

drop function if exists public.allocate_to_reserve(
	uuid,
	numeric,
	date,
	text,
	public.payment_method,
	uuid,
	text
);

create function public.allocate_to_reserve(
	p_reserve_id uuid,
	p_amount numeric,
	p_occurred_on date,
	p_description text,
	p_payment_method public.payment_method default 'cash',
	p_category_id uuid default null,
	p_notes text default null,
	p_deduct_from_cashflow boolean default true
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
	v_reserve_status text;
	v_reserve_entry_id uuid;
	v_should_deduct boolean := coalesce(p_deduct_from_cashflow, true);
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

	select r.id, r.status
	into v_reserve_id, v_reserve_status
	from public.reserves as r
	where r.id = p_reserve_id
	  and r.workspace_id = v_workspace_id
	limit 1
	for update;

	if v_reserve_id is null then
		raise exception 'RESERVE_NOT_FOUND';
	end if;

	if v_reserve_status <> 'active' then
		raise exception 'RESERVE_ARCHIVED';
	end if;

	if v_should_deduct and v_category_id is null then
		select c.id
		into v_category_id
		from public.categories as c
		where c.workspace_id = v_workspace_id
		  and lower(c.name) = 'reserva'
		order by c.is_system desc, c.id asc
		limit 1;
	end if;

	if v_should_deduct and v_category_id is null then
		raise exception 'RESERVE_CATEGORY_NOT_FOUND';
	end if;

	if v_should_deduct then
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
	end if;

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

create or replace function public.withdraw_from_reserve(
	p_reserve_id uuid,
	p_amount numeric,
	p_occurred_on date,
	p_description text,
	p_payment_method text default 'cash'
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
	v_current_amount numeric := 0;
	v_description text := nullif(trim(coalesce(p_description, '')), '');
	v_payment_method text := coalesce(
		nullif(lower(trim(coalesce(p_payment_method, ''))), ''),
		'cash'
	);
	v_reserve_id uuid;
	v_reserve_status text;
	v_reserve_entry_id uuid;
	v_transaction_id uuid;
	v_workspace_id uuid;
	v_category_id uuid;
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

	if v_payment_method not in ('cash', 'pix', 'debit') then
		raise exception 'INVALID_PAYMENT_METHOD';
	end if;

	select app_private.current_workspace_id()
	into v_workspace_id;

	if v_workspace_id is null then
		raise exception 'WORKSPACE_CONTEXT_REQUIRED';
	end if;

	select r.id, r.status
	into v_reserve_id, v_reserve_status
	from public.reserves as r
	where r.id = p_reserve_id
	  and r.workspace_id = v_workspace_id
	limit 1
	for update;

	if v_reserve_id is null then
		raise exception 'RESERVE_NOT_FOUND';
	end if;

	if v_reserve_status <> 'active' then
		raise exception 'RESERVE_ARCHIVED';
	end if;

	select coalesce(
		sum(
			case
				when re.entry_type = 'in' then re.amount
				else -re.amount
			end
		),
		0
	)::numeric
	into v_current_amount
	from public.reserve_entries as re
	where re.reserve_id = v_reserve_id
	  and re.workspace_id = v_workspace_id;

	if v_current_amount < p_amount then
		raise exception 'RESERVE_INSUFFICIENT_FUNDS';
	end if;

	select c.id
	into v_category_id
	from public.categories as c
	where c.workspace_id = v_workspace_id
	  and lower(c.name) = 'reserva'
	order by c.is_system desc, c.id asc
	limit 1;

	if v_category_id is null then
		raise exception 'RESERVE_CATEGORY_NOT_FOUND';
	end if;

	insert into public.transactions (
		workspace_id,
		category_id,
		description,
		transaction_type,
		amount,
		occurred_on,
		payment_method
	)
	values (
		v_workspace_id,
		v_category_id,
		v_description,
		'in',
		p_amount,
		p_occurred_on,
		v_payment_method::public.payment_method
	)
	returning id into v_transaction_id;

	insert into public.reserve_entries (
		reserve_id,
		workspace_id,
		source_transaction_id,
		entry_type,
		amount,
		occurred_on,
		description
	)
	values (
		v_reserve_id,
		v_workspace_id,
		v_transaction_id,
		'out',
		p_amount,
		p_occurred_on,
		v_description
	)
	returning id into v_reserve_entry_id;

	return query
	select v_transaction_id, v_reserve_entry_id;
end;
$$;

revoke all on function public.allocate_to_reserve(
	uuid,
	numeric,
	date,
	text,
	public.payment_method,
	uuid,
	text,
	boolean
) from public;
revoke all on function public.allocate_to_reserve(
	uuid,
	numeric,
	date,
	text,
	public.payment_method,
	uuid,
	text,
	boolean
) from anon;
revoke all on function public.allocate_to_reserve(
	uuid,
	numeric,
	date,
	text,
	public.payment_method,
	uuid,
	text,
	boolean
) from authenticated;
grant execute on function public.allocate_to_reserve(
	uuid,
	numeric,
	date,
	text,
	public.payment_method,
	uuid,
	text,
	boolean
) to authenticated;

revoke all on function public.withdraw_from_reserve(
	uuid,
	numeric,
	date,
	text,
	text
) from public;
revoke all on function public.withdraw_from_reserve(
	uuid,
	numeric,
	date,
	text,
	text
) from anon;
revoke all on function public.withdraw_from_reserve(
	uuid,
	numeric,
	date,
	text,
	text
) from authenticated;
grant execute on function public.withdraw_from_reserve(
	uuid,
	numeric,
	date,
	text,
	text
) to authenticated;

commit;
