begin;

create table public.marketing_email_topics (
	topic_key text primary key,
	label text not null,
	description text not null,
	sort_order integer not null,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint marketing_email_topics_key_check
		check (topic_key ~ '^[a-z][a-z0-9_]{2,63}$'),
	constraint marketing_email_topics_label_check
		check (char_length(btrim(label)) between 1 and 80),
	constraint marketing_email_topics_description_check
		check (char_length(btrim(description)) between 1 and 240),
	constraint marketing_email_topics_sort_order_check
		check (sort_order between 0 and 1000)
);

create unique index marketing_email_topics_sort_order_idx
	on public.marketing_email_topics (sort_order);

create trigger set_marketing_email_topics_updated_at
	before update on public.marketing_email_topics
	for each row execute function public.set_updated_at();

insert into public.marketing_email_topics (
	topic_key,
	label,
	description,
	sort_order
)
values
	(
		'product_and_launch_updates',
		'Product and launch updates',
		'Major blendCalc improvements, release news, and launch announcements.',
		10
	),
	(
		'mvp_testing_invitations',
		'MVP testing invitations',
		'Occasional invitations to test upcoming blendCalc features and share feedback.',
		20
	),
	(
		'tips_recipes_and_education',
		'Tips, recipes, and education',
		'Optional ideas for getting more value from ingredients, recipes, and food information.',
		30
	);

create table public.user_marketing_email_preferences (
	user_id uuid not null references auth.users(id) on delete cascade,
	topic_key text not null references public.marketing_email_topics(topic_key) on delete restrict,
	is_subscribed boolean not null default false,
	consent_copy_version text not null,
	source text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (user_id, topic_key),
	constraint user_marketing_email_preferences_consent_version_check
		check (consent_copy_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
	constraint user_marketing_email_preferences_source_check
		check (source in ('registration', 'profile', 'preference_link', 'provider_webhook'))
);

create index user_marketing_email_preferences_subscribed_idx
	on public.user_marketing_email_preferences (topic_key, user_id)
	where is_subscribed;

create trigger set_user_marketing_email_preferences_updated_at
	before update on public.user_marketing_email_preferences
	for each row execute function public.set_updated_at();

create table public.marketing_email_preference_events (
	id bigint generated always as identity primary key,
	user_id uuid not null references auth.users(id) on delete cascade,
	topic_key text not null references public.marketing_email_topics(topic_key) on delete restrict,
	is_subscribed boolean not null,
	consent_copy_version text not null,
	source text not null,
	created_at timestamptz not null default now(),
	constraint marketing_email_preference_events_consent_version_check
		check (consent_copy_version ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
	constraint marketing_email_preference_events_source_check
		check (source in ('registration', 'profile', 'preference_link', 'provider_webhook'))
);

create index marketing_email_preference_events_user_created_idx
	on public.marketing_email_preference_events (user_id, created_at desc);

alter table public.marketing_email_topics enable row level security;
alter table public.user_marketing_email_preferences enable row level security;
alter table public.marketing_email_preference_events enable row level security;

create policy "Authenticated users can read marketing email topics"
	on public.marketing_email_topics
	for select
	to authenticated
	using (true);

create policy "Users can read their marketing email preferences"
	on public.user_marketing_email_preferences
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Users can read their marketing email preference history"
	on public.marketing_email_preference_events
	for select
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.marketing_email_topics from public, anon, authenticated;
revoke all on table public.user_marketing_email_preferences from public, anon, authenticated;
revoke all on table public.marketing_email_preference_events from public, anon, authenticated;
grant select on table public.marketing_email_topics to authenticated;
grant select on table public.user_marketing_email_preferences to authenticated;
grant select on table public.marketing_email_preference_events to authenticated;
grant all on table public.marketing_email_topics to service_role;
grant all on table public.user_marketing_email_preferences to service_role;
grant all on table public.marketing_email_preference_events to service_role;

create or replace function public.apply_user_marketing_email_preferences(
	p_user_id uuid,
	p_preferences jsonb,
	p_source text,
	p_consent_copy_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_topic record;
	v_is_subscribed boolean;
	v_previous_subscription boolean;
begin
	if p_user_id is null then
		raise exception 'A user is required.' using errcode = '22023';
	end if;

	if jsonb_typeof(p_preferences) <> 'object' then
		raise exception 'Marketing email preferences must be an object.' using errcode = '22023';
	end if;

	if p_source not in ('registration', 'profile', 'preference_link', 'provider_webhook') then
		raise exception 'Marketing email preference source is invalid.' using errcode = '22023';
	end if;

	if p_consent_copy_version is null
		or p_consent_copy_version !~ '^[a-z0-9][a-z0-9._-]{0,63}$'
	then
		raise exception 'Marketing email consent version is invalid.' using errcode = '22023';
	end if;

	if exists (
		select 1
		from jsonb_object_keys(p_preferences) as submitted(topic_key)
		where not exists (
			select 1
			from public.marketing_email_topics topic
			where topic.topic_key = submitted.topic_key
				and topic.enabled
		)
	) then
		raise exception 'Marketing email preferences include an unsupported topic.' using errcode = '22023';
	end if;

	if (
		select count(*)
		from jsonb_object_keys(p_preferences)
	) <> (
		select count(*)
		from public.marketing_email_topics
		where enabled
	) then
		raise exception 'Marketing email preferences must include every available topic.' using errcode = '22023';
	end if;

	for v_topic in
		select topic_key
		from public.marketing_email_topics
		where enabled
		order by sort_order
	loop
		if jsonb_typeof(p_preferences -> v_topic.topic_key) <> 'boolean' then
			raise exception 'Marketing email preference values must be boolean.' using errcode = '22023';
		end if;

		v_is_subscribed := (p_preferences ->> v_topic.topic_key)::boolean;

		select preference.is_subscribed
		into v_previous_subscription
		from public.user_marketing_email_preferences preference
		where preference.user_id = p_user_id
			and preference.topic_key = v_topic.topic_key;

		insert into public.user_marketing_email_preferences (
			user_id,
			topic_key,
			is_subscribed,
			consent_copy_version,
			source
		)
		values (
			p_user_id,
			v_topic.topic_key,
			v_is_subscribed,
			p_consent_copy_version,
			p_source
		)
		on conflict (user_id, topic_key) do update
		set is_subscribed = excluded.is_subscribed,
			consent_copy_version = excluded.consent_copy_version,
			source = excluded.source;

		if v_previous_subscription is null
			or v_previous_subscription is distinct from v_is_subscribed
		then
			insert into public.marketing_email_preference_events (
				user_id,
				topic_key,
				is_subscribed,
				consent_copy_version,
				source
			)
			values (
				p_user_id,
				v_topic.topic_key,
				v_is_subscribed,
				p_consent_copy_version,
				p_source
			);
		end if;
	end loop;
end;
$$;

create or replace function public.save_current_user_marketing_email_preferences(
	p_preferences jsonb,
	p_consent_copy_version text
)
returns table (
	topic_key text,
	is_subscribed boolean
)
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

	perform public.apply_user_marketing_email_preferences(
		v_user_id,
		p_preferences,
		'profile',
		p_consent_copy_version
	);

	return query
	select
		topic.topic_key,
		coalesce(preference.is_subscribed, false)
	from public.marketing_email_topics topic
	left join public.user_marketing_email_preferences preference
		on preference.user_id = v_user_id
		and preference.topic_key = topic.topic_key
	where topic.enabled
	order by topic.sort_order;
end;
$$;

create or replace function public.get_current_user_marketing_email_preferences()
returns table (
	topic_key text,
	label text,
	description text,
	is_subscribed boolean,
	updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
	select
		topic.topic_key,
		topic.label,
		topic.description,
		coalesce(preference.is_subscribed, false),
		preference.updated_at
	from public.marketing_email_topics topic
	left join public.user_marketing_email_preferences preference
		on preference.user_id = auth.uid()
		and preference.topic_key = topic.topic_key
	where auth.uid() is not null
		and topic.enabled
	order by topic.sort_order;
$$;

create or replace function public.record_new_auth_user_marketing_email_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_opt_in jsonb := new.raw_user_meta_data -> 'marketing_email_opt_in';
	v_consent_copy_version text := new.raw_user_meta_data ->> 'marketing_email_consent_version';
	v_preferences jsonb;
begin
	if v_opt_in is null or jsonb_typeof(v_opt_in) <> 'boolean' then
		return new;
	end if;

	select jsonb_object_agg(topic_key, (v_opt_in #>> '{}')::boolean)
	into v_preferences
	from public.marketing_email_topics
	where enabled;

	if v_preferences is not null then
		perform public.apply_user_marketing_email_preferences(
			new.id,
			v_preferences,
			'registration',
			v_consent_copy_version
		);
	end if;

	return new;
end;
$$;

drop trigger if exists record_new_auth_user_marketing_email_consent on auth.users;
create trigger record_new_auth_user_marketing_email_consent
	after insert on auth.users
	for each row execute function public.record_new_auth_user_marketing_email_consent();

revoke all on function public.apply_user_marketing_email_preferences(uuid, jsonb, text, text)
	from public, anon, authenticated;
revoke all on function public.save_current_user_marketing_email_preferences(jsonb, text)
	from public, anon;
revoke all on function public.get_current_user_marketing_email_preferences()
	from public, anon;
revoke all on function public.record_new_auth_user_marketing_email_consent()
	from public, anon, authenticated;

grant execute on function public.save_current_user_marketing_email_preferences(jsonb, text)
	to authenticated;
grant execute on function public.get_current_user_marketing_email_preferences()
	to authenticated;
grant execute on function public.apply_user_marketing_email_preferences(uuid, jsonb, text, text)
	to service_role;

comment on table public.marketing_email_topics is
	'The DB-owned catalog of optional promotional email categories. Transactional and security email never enters this catalog.';
comment on table public.user_marketing_email_preferences is
	'The latest explicit per-topic promotional email choice for an account. Missing rows mean not subscribed.';
comment on table public.marketing_email_preference_events is
	'Append-only evidence of explicit promotional email preference changes without copying account email addresses.';
comment on function public.save_current_user_marketing_email_preferences(jsonb, text) is
	'Atomically validates and saves every optional promotional email topic for the authenticated account.';
comment on function public.get_current_user_marketing_email_preferences() is
	'Returns the active promotional topic catalog with opt-out-safe effective values for the authenticated account.';

commit;
