create table public.mix_goal_template_versions (
	id uuid primary key default gen_random_uuid(),
	template_key text not null references public.mix_goal_templates(key) on delete cascade,
	version integer not null check (version > 0),
	display_name text not null check (btrim(display_name) <> ''),
	description text not null check (btrim(description) <> ''),
	goal_basis text not null check (goal_basis in ('per_mix', 'per_serving')),
	status text not null check (status in ('draft', 'active', 'retired')),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	reviewed_at timestamptz,
	reviewed_by uuid references auth.users(id) on delete set null,
	published_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (template_key, version),
	check (
		(status = 'draft' and published_at is null)
		or (status in ('active', 'retired') and reviewed_at is not null and published_at is not null)
	)
);

create unique index mix_goal_template_versions_one_active_idx
	on public.mix_goal_template_versions (template_key)
	where status = 'active';

insert into public.mix_goal_template_versions (
	template_key,
	version,
	display_name,
	description,
	goal_basis,
	status,
	source_key,
	source_reference,
	reviewed_at,
	published_at,
	created_at,
	updated_at
)
select
	template.key,
	template.version,
	template.display_name,
	template.description,
	'per_mix',
	'active',
	template.source_key,
	template.source_reference,
	template.updated_at,
	template.updated_at,
	template.created_at,
	template.updated_at
from public.mix_goal_templates template;

alter table public.mix_goal_template_targets
	rename to mix_goal_template_targets_legacy;

create table public.mix_goal_template_targets (
	template_version_id uuid not null references public.mix_goal_template_versions(id) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	goal_type text not null check (goal_type in ('exact', 'minimum', 'maximum', 'range')),
	target_amount numeric not null check (target_amount >= 0),
	upper_amount numeric,
	tolerance_ratio numeric not null default 0.05 check (tolerance_ratio >= 0 and tolerance_ratio <= 1),
	importance_weight numeric not null default 1 check (importance_weight > 0 and importance_weight <= 100),
	sort_order integer not null check (sort_order > 0),
	rationale text not null check (btrim(rationale) <> ''),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	primary key (template_version_id, nutrient_id),
	unique (template_version_id, sort_order),
	check (
		(goal_type = 'range' and upper_amount is not null and upper_amount >= target_amount)
		or (goal_type <> 'range' and upper_amount is null)
	)
);

insert into public.mix_goal_template_targets (
	template_version_id,
	nutrient_id,
	goal_type,
	target_amount,
	upper_amount,
	tolerance_ratio,
	importance_weight,
	sort_order,
	rationale,
	source_key,
	source_reference
)
select
	version.id,
	target.nutrient_id,
	case
		when target.nutrient_id in (1003, 1079) then 'minimum'
		when target.nutrient_id in (1004, 2000) then 'maximum'
		else 'exact'
	end,
	target.target_amount,
	null,
	0.05,
	1,
	row_number() over (
		partition by target.template_key
		order by display_field.sort_order nulls last, target.nutrient_id
	)::integer,
	case
		when target.nutrient_id in (1003, 1079)
			then concat(definition.nutrient_name, ' is treated as a minimum goal for this preset.')
		when target.nutrient_id in (1004, 2000)
			then concat(definition.nutrient_name, ' is treated as a maximum goal for this preset.')
		else concat(definition.nutrient_name, ' is treated as a point target for this preset.')
	end,
	version.source_key,
	version.source_reference
from public.mix_goal_template_targets_legacy target
join public.mix_goal_template_versions version
	on version.template_key = target.template_key
	and version.status = 'active'
join public.nutrient_definitions definition
	on definition.nutrient_id = target.nutrient_id
left join public.nutrient_display_profile_fields display_field
	on display_field.profile_key = 'mix-default-v1'
	and display_field.nutrient_id = target.nutrient_id;

drop table public.mix_goal_template_targets_legacy;

alter table public.mix_goal_templates
	add column current_version_id uuid,
	add column is_default boolean not null default false;

update public.mix_goal_templates template
set current_version_id = version.id,
	is_default = template.key = 'balanced'
from public.mix_goal_template_versions version
where version.template_key = template.key
	and version.status = 'active';

alter table public.mix_goal_templates
	add constraint mix_goal_templates_current_version_id_fkey
		foreign key (current_version_id)
		references public.mix_goal_template_versions(id)
		on delete restrict,
	drop column display_name,
	drop column description,
	drop column version,
	drop column source_key,
	drop column source_reference;

create unique index mix_goal_templates_one_default_idx
	on public.mix_goal_templates (is_default)
	where is_default and enabled;

create table public.user_mix_goal_templates (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
	description text not null default '' check (char_length(description) <= 240),
	goal_basis text not null check (goal_basis in ('per_mix', 'per_serving')),
	source_template_version_id uuid references public.mix_goal_template_versions(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index user_mix_goal_templates_name_idx
	on public.user_mix_goal_templates (user_id, lower(btrim(display_name)));

create index user_mix_goal_templates_user_updated_idx
	on public.user_mix_goal_templates (user_id, updated_at desc);

create table public.user_mix_goal_template_targets (
	template_id uuid not null references public.user_mix_goal_templates(id) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	goal_type text not null check (goal_type in ('exact', 'minimum', 'maximum', 'range')),
	target_amount numeric not null check (target_amount >= 0),
	upper_amount numeric,
	tolerance_ratio numeric not null default 0.05 check (tolerance_ratio >= 0 and tolerance_ratio <= 1),
	importance_weight numeric not null default 1 check (importance_weight > 0 and importance_weight <= 100),
	sort_order integer not null check (sort_order > 0),
	primary key (template_id, nutrient_id),
	unique (template_id, sort_order),
	check (
		(goal_type = 'range' and upper_amount is not null and upper_amount >= target_amount)
		or (goal_type <> 'range' and upper_amount is null)
	)
);

create table public.user_mix_nutrient_goals (
	user_id uuid not null references auth.users(id) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	goal_type text not null check (goal_type in ('exact', 'minimum', 'maximum', 'range')),
	target_amount numeric not null check (target_amount >= 0),
	upper_amount numeric,
	tolerance_ratio numeric not null default 0.05 check (tolerance_ratio >= 0 and tolerance_ratio <= 1),
	importance_weight numeric not null default 1 check (importance_weight > 0 and importance_weight <= 100),
	sort_order integer not null check (sort_order > 0),
	source_template_version_id uuid references public.mix_goal_template_versions(id) on delete set null,
	source_user_template_id uuid references public.user_mix_goal_templates(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (user_id, nutrient_id),
	unique (user_id, sort_order),
	check (num_nonnulls(source_template_version_id, source_user_template_id) <= 1),
	check (
		(goal_type = 'range' and upper_amount is not null and upper_amount >= target_amount)
		or (goal_type <> 'range' and upper_amount is null)
	)
);

alter table public.mix_preferences
	add column goal_basis text not null default 'per_mix'
		check (goal_basis in ('per_mix', 'per_serving')),
	add column source_goal_template_version_id uuid
		references public.mix_goal_template_versions(id) on delete set null,
	add column source_user_goal_template_id uuid
		references public.user_mix_goal_templates(id) on delete set null,
	add column goal_configuration_initialized boolean not null default false,
	add column goal_template_customized boolean not null default true,
	add constraint mix_preferences_single_goal_template_source_check
		check (num_nonnulls(source_goal_template_version_id, source_user_goal_template_id) <= 1);

insert into public.user_mix_nutrient_goals (
	user_id,
	nutrient_id,
	goal_type,
	target_amount,
	upper_amount,
	tolerance_ratio,
	importance_weight,
	sort_order
)
select
	preference.user_id,
	goal.key::bigint,
	'exact',
	(goal.value #>> '{}')::numeric,
	null,
	0.05,
	1,
	row_number() over (partition by preference.user_id order by goal.key::bigint)::integer
from public.mix_preferences preference
cross join lateral jsonb_each(preference.nutrient_goals) goal
join public.nutrient_definitions definition
	on definition.nutrient_id = goal.key::bigint
where goal.key ~ '^[0-9]+$'
	and jsonb_typeof(goal.value) = 'number'
	and (goal.value #>> '{}')::numeric >= 0
on conflict (user_id, nutrient_id) do nothing;

update public.mix_preferences preference
set goal_configuration_initialized = true
where exists (
	select 1
	from public.user_mix_nutrient_goals goal
	where goal.user_id = preference.user_id
);

drop function if exists public.save_mix_preferences(jsonb, jsonb);

alter table public.mix_preferences
	drop column nutrient_goals;

create trigger set_mix_goal_template_versions_updated_at
	before update on public.mix_goal_template_versions
	for each row execute function public.set_updated_at();

create trigger set_user_mix_goal_templates_updated_at
	before update on public.user_mix_goal_templates
	for each row execute function public.set_updated_at();

create trigger set_user_mix_nutrient_goals_updated_at
	before update on public.user_mix_nutrient_goals
	for each row execute function public.set_updated_at();

create or replace function private.validate_current_mix_goal_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if new.enabled and new.current_version_id is null then
		raise exception 'An enabled Mix goal template requires a current version.' using errcode = '23514';
	end if;
	if new.current_version_id is not null and not exists (
		select 1
		from public.mix_goal_template_versions version
		where version.id = new.current_version_id
			and version.template_key = new.key
			and version.status = 'active'
	) then
		raise exception 'The current Mix goal template version must be the active version for the same template.' using errcode = '23514';
	end if;
	return new;
end;
$$;

create or replace function private.protect_published_mix_goal_template_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_op = 'DELETE' then
		if old.status in ('active', 'retired') then
			raise exception 'Published Mix goal template versions are immutable.' using errcode = '55000';
		end if;
		return old;
	end if;

	if old.status in ('active', 'retired') and (
		new.template_key is distinct from old.template_key
		or new.version is distinct from old.version
		or new.display_name is distinct from old.display_name
		or new.description is distinct from old.description
		or new.goal_basis is distinct from old.goal_basis
		or new.source_key is distinct from old.source_key
		or new.source_reference is distinct from old.source_reference
		or new.reviewed_at is distinct from old.reviewed_at
		or new.reviewed_by is distinct from old.reviewed_by
		or new.published_at is distinct from old.published_at
	) then
		raise exception 'Published Mix goal template versions are immutable.' using errcode = '55000';
	end if;

	return new;
end;
$$;

create or replace function private.protect_published_mix_goal_template_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_version_id uuid := case when tg_op = 'DELETE' then old.template_version_id else new.template_version_id end;
begin
	if exists (
		select 1
		from public.mix_goal_template_versions version
		where version.id = v_version_id
			and version.status in ('active', 'retired')
	) then
		raise exception 'Targets belonging to published Mix goal template versions are immutable.' using errcode = '55000';
	end if;
	return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger validate_current_mix_goal_template_version
	before insert or update of enabled, current_version_id
	on public.mix_goal_templates
	for each row execute function private.validate_current_mix_goal_template_version();

create trigger protect_published_mix_goal_template_version
	before update or delete on public.mix_goal_template_versions
	for each row execute function private.protect_published_mix_goal_template_version();

create trigger protect_published_mix_goal_template_target
	before insert or update or delete on public.mix_goal_template_targets
	for each row execute function private.protect_published_mix_goal_template_target();

create or replace function private.validate_mix_goal_payload(p_goals jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
	if p_goals is null or jsonb_typeof(p_goals) <> 'array' then
		raise exception 'Mix goals must be a JSON array.' using errcode = '22023';
	end if;
	if jsonb_array_length(p_goals) > 50 then
		raise exception 'Mix goals cannot contain more than 50 nutrients.' using errcode = '22023';
	end if;
	if exists (
		select 1
		from jsonb_to_recordset(p_goals) as goal(
			nutrient_id bigint,
			goal_type text,
			target_amount numeric,
			upper_amount numeric,
			tolerance_ratio numeric,
			importance_weight numeric,
			sort_order integer
		)
		left join public.nutrient_definitions definition
			on definition.nutrient_id = goal.nutrient_id
		where definition.nutrient_id is null
			or goal.goal_type not in ('exact', 'minimum', 'maximum', 'range')
			or goal.target_amount is null
			or goal.target_amount < 0
			or goal.tolerance_ratio is null
			or goal.tolerance_ratio < 0
			or goal.tolerance_ratio > 1
			or goal.importance_weight is null
			or goal.importance_weight <= 0
			or goal.importance_weight > 100
			or goal.sort_order is null
			or goal.sort_order <= 0
			or (goal.goal_type = 'range' and (goal.upper_amount is null or goal.upper_amount < goal.target_amount))
			or (goal.goal_type <> 'range' and goal.upper_amount is not null)
	) then
		raise exception 'Mix goals contain invalid nutrient, amount, type, tolerance, weight, or ordering data.' using errcode = '22023';
	end if;
	if exists (
		select 1
		from jsonb_to_recordset(p_goals) as goal(nutrient_id bigint, sort_order integer)
		group by goal.nutrient_id
		having count(*) > 1
	) or exists (
		select 1
		from jsonb_to_recordset(p_goals) as goal(nutrient_id bigint, sort_order integer)
		group by goal.sort_order
		having count(*) > 1
	) then
		raise exception 'Mix goals contain duplicate nutrients or sort positions.' using errcode = '22023';
	end if;
end;
$$;

create or replace function private.user_mix_goals_json(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
	select coalesce(
		jsonb_agg(
			jsonb_build_object(
				'nutrientId', goal.nutrient_id,
				'goalType', goal.goal_type,
				'targetAmount', goal.target_amount,
				'upperAmount', goal.upper_amount,
				'toleranceRatio', goal.tolerance_ratio,
				'importanceWeight', goal.importance_weight,
				'sortOrder', goal.sort_order
			)
			order by goal.sort_order
		),
		'[]'::jsonb
	)
	from public.user_mix_nutrient_goals goal
	where goal.user_id = p_user_id;
$$;

create or replace function public.save_mix_preferences(
	p_mix_state jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_mix_state is not null and jsonb_typeof(p_mix_state) <> 'object' then
		raise exception 'Mix state must be a JSON object.' using errcode = '22023';
	end if;

	insert into public.mix_preferences (user_id, mix_state)
	values (v_user_id, coalesce(p_mix_state, '{}'::jsonb))
	on conflict (user_id) do update
	set mix_state = coalesce(p_mix_state, public.mix_preferences.mix_state);
	return true;
end;
$$;

create or replace function public.save_mix_goal_configuration(
	p_goals jsonb,
	p_goal_basis text default 'per_mix',
	p_source_template_version_id uuid default null,
	p_source_user_template_id uuid default null,
	p_customized boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_goal_basis <> 'per_mix' then
		raise exception 'Unsupported Mix goal basis.' using errcode = '22023';
	end if;
	if num_nonnulls(p_source_template_version_id, p_source_user_template_id) > 1 then
		raise exception 'A Mix goal configuration can have only one template source.' using errcode = '22023';
	end if;
	if not p_customized then
		raise exception 'Unmodified presets must be applied through their authoritative preset function.' using errcode = '22023';
	end if;
	if p_source_template_version_id is not null and not exists (
		select 1 from public.mix_goal_template_versions version
		where version.id = p_source_template_version_id
			and version.status in ('active', 'retired')
	) then
		raise exception 'The system goal preset version is unavailable.' using errcode = '22023';
	end if;
	if p_source_user_template_id is not null and not exists (
		select 1 from public.user_mix_goal_templates template
		where template.id = p_source_user_template_id
			and template.user_id = v_user_id
	) then
		raise exception 'The personal goal preset is unavailable.' using errcode = '22023';
	end if;

	perform private.validate_mix_goal_payload(p_goals);

	insert into public.mix_preferences (
		user_id,
		mix_state,
		goal_basis,
		source_goal_template_version_id,
		source_user_goal_template_id,
		goal_configuration_initialized,
		goal_template_customized
	)
	values (
		v_user_id,
		'{}'::jsonb,
		p_goal_basis,
		p_source_template_version_id,
		p_source_user_template_id,
		true,
		p_customized
	)
	on conflict (user_id) do update
	set
		goal_basis = excluded.goal_basis,
		source_goal_template_version_id = excluded.source_goal_template_version_id,
		source_user_goal_template_id = excluded.source_user_goal_template_id,
		goal_configuration_initialized = true,
		goal_template_customized = excluded.goal_template_customized;

	delete from public.user_mix_nutrient_goals
	where user_id = v_user_id;

	insert into public.user_mix_nutrient_goals (
		user_id,
		nutrient_id,
		goal_type,
		target_amount,
		upper_amount,
		tolerance_ratio,
		importance_weight,
		sort_order,
		source_template_version_id,
		source_user_template_id
	)
	select
		v_user_id,
		goal.nutrient_id,
		goal.goal_type,
		goal.target_amount,
		goal.upper_amount,
		goal.tolerance_ratio,
		goal.importance_weight,
		goal.sort_order,
		p_source_template_version_id,
		p_source_user_template_id
	from jsonb_to_recordset(p_goals) as goal(
		nutrient_id bigint,
		goal_type text,
		target_amount numeric,
		upper_amount numeric,
		tolerance_ratio numeric,
		importance_weight numeric,
		sort_order integer
	);

	return private.user_mix_goals_json(v_user_id);
end;
$$;

create or replace function public.apply_mix_goal_template(
	p_template_version_id uuid,
	p_keep_extra_goals boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_basis text;
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	select version.goal_basis
	into v_basis
	from public.mix_goal_template_versions version
	join public.mix_goal_templates template
		on template.key = version.template_key
	where version.id = p_template_version_id
		and version.status = 'active'
		and template.enabled
		and template.current_version_id = version.id;

	if v_basis is null then
		raise exception 'The selected goal preset is unavailable.' using errcode = '22023';
	end if;
	if v_basis <> 'per_mix' then
		raise exception 'Per-serving goal presets require a serving count and cannot be applied yet.' using errcode = '22023';
	end if;

	insert into public.mix_preferences (
		user_id,
		mix_state,
		goal_basis,
		source_goal_template_version_id,
		source_user_goal_template_id,
		goal_configuration_initialized,
		goal_template_customized
	)
	values (v_user_id, '{}'::jsonb, v_basis, p_template_version_id, null, true, p_keep_extra_goals)
	on conflict (user_id) do update
	set
		goal_basis = excluded.goal_basis,
		source_goal_template_version_id = excluded.source_goal_template_version_id,
		source_user_goal_template_id = null,
		goal_configuration_initialized = true,
		goal_template_customized = p_keep_extra_goals;

	if p_keep_extra_goals then
		update public.user_mix_nutrient_goals
		set sort_order = sort_order + 1000
		where user_id = v_user_id;
	else
		delete from public.user_mix_nutrient_goals where user_id = v_user_id;
	end if;

	insert into public.user_mix_nutrient_goals (
		user_id,
		nutrient_id,
		goal_type,
		target_amount,
		upper_amount,
		tolerance_ratio,
		importance_weight,
		sort_order,
		source_template_version_id,
		source_user_template_id
	)
	select
		v_user_id,
		target.nutrient_id,
		target.goal_type,
		target.target_amount,
		target.upper_amount,
		target.tolerance_ratio,
		target.importance_weight,
		target.sort_order,
		p_template_version_id,
		null
	from public.mix_goal_template_targets target
	where target.template_version_id = p_template_version_id
	on conflict (user_id, nutrient_id) do update
	set
		goal_type = excluded.goal_type,
		target_amount = excluded.target_amount,
		upper_amount = excluded.upper_amount,
		tolerance_ratio = excluded.tolerance_ratio,
		importance_weight = excluded.importance_weight,
		sort_order = excluded.sort_order,
		source_template_version_id = excluded.source_template_version_id,
		source_user_template_id = null;

	if p_keep_extra_goals then
		with ordered_extras as (
			select
				goal.nutrient_id,
				(
					select count(*)
					from public.mix_goal_template_targets target
					where target.template_version_id = p_template_version_id
				)::integer + row_number() over (order by goal.sort_order, goal.nutrient_id)::integer as sort_order
			from public.user_mix_nutrient_goals goal
			where goal.user_id = v_user_id
				and goal.source_template_version_id is distinct from p_template_version_id
		)
		update public.user_mix_nutrient_goals goal
		set sort_order = ordered_extras.sort_order
		from ordered_extras
		where goal.user_id = v_user_id
			and goal.nutrient_id = ordered_extras.nutrient_id;
	end if;

	return private.user_mix_goals_json(v_user_id);
end;
$$;

create or replace function public.save_user_mix_goal_template(
	p_display_name text,
	p_description text,
	p_goal_basis text,
	p_goals jsonb,
	p_source_template_version_id uuid default null,
	p_template_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_template_id uuid := coalesce(p_template_id, gen_random_uuid());
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 80 then
		raise exception 'Goal preset names must contain 1 through 80 characters.' using errcode = '22023';
	end if;
	if char_length(coalesce(p_description, '')) > 240 then
		raise exception 'Goal preset descriptions cannot exceed 240 characters.' using errcode = '22023';
	end if;
	if p_goal_basis <> 'per_mix' then
		raise exception 'Unsupported Mix goal basis.' using errcode = '22023';
	end if;
	if p_source_template_version_id is not null and not exists (
		select 1 from public.mix_goal_template_versions version
		where version.id = p_source_template_version_id
			and version.status in ('active', 'retired')
	) then
		raise exception 'The source goal preset version is unavailable.' using errcode = '22023';
	end if;
	if jsonb_array_length(p_goals) = 0 then
		raise exception 'A goal preset must contain at least one nutrient.' using errcode = '22023';
	end if;
	if p_template_id is not null and not exists (
		select 1 from public.user_mix_goal_templates template
		where template.id = p_template_id and template.user_id = v_user_id
	) then
		raise exception 'The personal goal preset is unavailable.' using errcode = '42501';
	end if;

	perform private.validate_mix_goal_payload(p_goals);

	insert into public.user_mix_goal_templates (
		id,
		user_id,
		display_name,
		description,
		goal_basis,
		source_template_version_id
	)
	values (
		v_template_id,
		v_user_id,
		btrim(p_display_name),
		coalesce(p_description, ''),
		p_goal_basis,
		p_source_template_version_id
	)
	on conflict (id) do update
	set
		display_name = excluded.display_name,
		description = excluded.description,
		goal_basis = excluded.goal_basis,
		source_template_version_id = excluded.source_template_version_id;

	delete from public.user_mix_goal_template_targets
	where template_id = v_template_id;

	insert into public.user_mix_goal_template_targets (
		template_id,
		nutrient_id,
		goal_type,
		target_amount,
		upper_amount,
		tolerance_ratio,
		importance_weight,
		sort_order
	)
	select
		v_template_id,
		goal.nutrient_id,
		goal.goal_type,
		goal.target_amount,
		goal.upper_amount,
		goal.tolerance_ratio,
		goal.importance_weight,
		goal.sort_order
	from jsonb_to_recordset(p_goals) as goal(
		nutrient_id bigint,
		goal_type text,
		target_amount numeric,
		upper_amount numeric,
		tolerance_ratio numeric,
		importance_weight numeric,
		sort_order integer
	);

	return v_template_id;
end;
$$;

create or replace function public.apply_user_mix_goal_template(
	p_template_id uuid,
	p_keep_extra_goals boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_basis text;
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	select template.goal_basis
	into v_basis
	from public.user_mix_goal_templates template
	where template.id = p_template_id
		and template.user_id = v_user_id;

	if v_basis is null then
		raise exception 'The personal goal preset is unavailable.' using errcode = '22023';
	end if;
	if v_basis <> 'per_mix' then
		raise exception 'Per-serving goal presets require a serving count and cannot be applied yet.' using errcode = '22023';
	end if;

	insert into public.mix_preferences (
		user_id,
		mix_state,
		goal_basis,
		source_goal_template_version_id,
		source_user_goal_template_id,
		goal_configuration_initialized,
		goal_template_customized
	)
	values (v_user_id, '{}'::jsonb, v_basis, null, p_template_id, true, p_keep_extra_goals)
	on conflict (user_id) do update
	set
		goal_basis = excluded.goal_basis,
		source_goal_template_version_id = null,
		source_user_goal_template_id = excluded.source_user_goal_template_id,
		goal_configuration_initialized = true,
		goal_template_customized = p_keep_extra_goals;

	if p_keep_extra_goals then
		update public.user_mix_nutrient_goals
		set sort_order = sort_order + 1000
		where user_id = v_user_id;
	else
		delete from public.user_mix_nutrient_goals where user_id = v_user_id;
	end if;

	insert into public.user_mix_nutrient_goals (
		user_id,
		nutrient_id,
		goal_type,
		target_amount,
		upper_amount,
		tolerance_ratio,
		importance_weight,
		sort_order,
		source_template_version_id,
		source_user_template_id
	)
	select
		v_user_id,
		target.nutrient_id,
		target.goal_type,
		target.target_amount,
		target.upper_amount,
		target.tolerance_ratio,
		target.importance_weight,
		target.sort_order,
		null,
		p_template_id
	from public.user_mix_goal_template_targets target
	where target.template_id = p_template_id
	on conflict (user_id, nutrient_id) do update
	set
		goal_type = excluded.goal_type,
		target_amount = excluded.target_amount,
		upper_amount = excluded.upper_amount,
		tolerance_ratio = excluded.tolerance_ratio,
		importance_weight = excluded.importance_weight,
		sort_order = excluded.sort_order,
		source_template_version_id = null,
		source_user_template_id = excluded.source_user_template_id;

	if p_keep_extra_goals then
		with ordered_extras as (
			select
				goal.nutrient_id,
				(
					select count(*)
					from public.user_mix_goal_template_targets target
					where target.template_id = p_template_id
				)::integer + row_number() over (order by goal.sort_order, goal.nutrient_id)::integer as sort_order
			from public.user_mix_nutrient_goals goal
			where goal.user_id = v_user_id
				and goal.source_user_template_id is distinct from p_template_id
		)
		update public.user_mix_nutrient_goals goal
		set sort_order = ordered_extras.sort_order
		from ordered_extras
		where goal.user_id = v_user_id
			and goal.nutrient_id = ordered_extras.nutrient_id;
	end if;

	return private.user_mix_goals_json(v_user_id);
end;
$$;

create or replace function public.delete_user_mix_goal_template(p_template_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	update public.mix_preferences
	set goal_template_customized = true
	where user_id = v_user_id
		and source_user_goal_template_id = p_template_id;

	delete from public.user_mix_goal_templates
	where id = p_template_id and user_id = v_user_id;
	return found;
end;
$$;

alter table public.mix_goal_template_versions enable row level security;
alter table public.mix_goal_template_versions force row level security;
alter table public.mix_goal_template_targets enable row level security;
alter table public.mix_goal_template_targets force row level security;
alter table public.user_mix_goal_templates enable row level security;
alter table public.user_mix_goal_templates force row level security;
alter table public.user_mix_goal_template_targets enable row level security;
alter table public.user_mix_goal_template_targets force row level security;
alter table public.user_mix_nutrient_goals enable row level security;
alter table public.user_mix_nutrient_goals force row level security;

create policy "Authenticated users can read published Mix goal template versions"
	on public.mix_goal_template_versions for select to authenticated
	using (status in ('active', 'retired'));

create policy "Authenticated users can read published Mix goal template targets"
	on public.mix_goal_template_targets for select to authenticated
	using (exists (
		select 1 from public.mix_goal_template_versions version
		where version.id = template_version_id
			and version.status in ('active', 'retired')
	));

create policy "Users can read their Mix goal templates"
	on public.user_mix_goal_templates for select to authenticated
	using (user_id = auth.uid());

create policy "Users can read their Mix goal template targets"
	on public.user_mix_goal_template_targets for select to authenticated
	using (exists (
		select 1 from public.user_mix_goal_templates template
		where template.id = template_id and template.user_id = auth.uid()
	));

create policy "Users can read their active Mix nutrient goals"
	on public.user_mix_nutrient_goals for select to authenticated
	using (user_id = auth.uid());

revoke all on table public.mix_goal_template_versions from public, anon, authenticated;
revoke all on table public.mix_goal_template_targets from public, anon, authenticated;
revoke all on table public.user_mix_goal_templates from public, anon, authenticated;
revoke all on table public.user_mix_goal_template_targets from public, anon, authenticated;
revoke all on table public.user_mix_nutrient_goals from public, anon, authenticated;

grant select on table public.mix_goal_template_versions to authenticated;
grant select on table public.mix_goal_template_targets to authenticated;
grant select on table public.user_mix_goal_templates to authenticated;
grant select on table public.user_mix_goal_template_targets to authenticated;
grant select on table public.user_mix_nutrient_goals to authenticated;

grant all on table public.mix_goal_template_versions to service_role;
grant all on table public.mix_goal_template_targets to service_role;
grant all on table public.user_mix_goal_templates to service_role;
grant all on table public.user_mix_goal_template_targets to service_role;
grant all on table public.user_mix_nutrient_goals to service_role;

revoke all on function private.validate_mix_goal_payload(jsonb) from public, anon, authenticated;
revoke all on function private.user_mix_goals_json(uuid) from public, anon, authenticated;
revoke all on function private.validate_current_mix_goal_template_version() from public, anon, authenticated;
revoke all on function private.protect_published_mix_goal_template_version() from public, anon, authenticated;
revoke all on function private.protect_published_mix_goal_template_target() from public, anon, authenticated;
revoke all on function public.save_mix_preferences(jsonb) from public, anon, authenticated;
revoke all on function public.save_mix_goal_configuration(jsonb, text, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.apply_mix_goal_template(uuid, boolean) from public, anon, authenticated;
revoke all on function public.save_user_mix_goal_template(text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_user_mix_goal_template(uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_user_mix_goal_template(uuid) from public, anon, authenticated;

grant execute on function public.save_mix_preferences(jsonb) to authenticated, service_role;
grant execute on function public.save_mix_goal_configuration(jsonb, text, uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.apply_mix_goal_template(uuid, boolean) to authenticated, service_role;
grant execute on function public.save_user_mix_goal_template(text, text, text, jsonb, uuid, uuid) to authenticated, service_role;
grant execute on function public.apply_user_mix_goal_template(uuid, boolean) to authenticated, service_role;
grant execute on function public.delete_user_mix_goal_template(uuid) to authenticated, service_role;

comment on table public.mix_goal_templates is
	'Stable identities for DB-owned Mix goal presets. User-facing content and target rules live in immutable reviewed versions.';
comment on table public.mix_goal_template_versions is
	'Immutable reviewed versions of DB-owned Mix goal presets. Active versions are general planning presets, not medical recommendations.';
comment on table public.mix_goal_template_targets is
	'Versioned nutrient goal semantics, values, weighting, rationale, and field-level source evidence for system Mix presets.';
comment on table public.user_mix_goal_templates is
	'Private user-owned reusable Mix goal presets. They are never public or canonical system guidance.';
comment on table public.user_mix_nutrient_goals is
	'Normalized active nutrient-goal configuration for one user, including direction, tolerance, weighting, and copied template provenance.';
