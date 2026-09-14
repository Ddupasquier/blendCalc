/**
 * BlendCalc-specific local identity and application environment adapter for the
 * project-neutral Rehearsal runtime manager. It receives no hosted credentials.
 */

import { createHash } from "node:crypto";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACCOUNT = Object.freeze({
	email: "rehearsal-owner@blendcalc.local",
	password: "BlendCalc-Local-Rehearsal-2026!",
});
const LOCAL_GOOGLE_PROOF = Object.freeze({
	id: "55555555-5555-4555-8555-555555555555",
	email: "rehearsal-google-owner@blendcalc.local",
});

export const prepareSchema = ({ runSql }) => {
	runSql(`create schema if not exists public;
create extension if not exists pg_trgm with schema public;`);
	return {
		message: "BlendCalc's public-schema extension prerequisites are installed.",
	};
};

export const configureRuntime = ({ runSql, environment, baseline }) => {
	const userId = baseline.ownerPersonaUserId;
	if (!UUID_PATTERN.test(userId)) {
		throw new Error(
			"The sanitized baseline contains no approved owner persona identity.",
		);
	}
	if (!/^[a-f0-9]{64}$/u.test(baseline.ownerEmailSha256 ?? "")) {
		throw new Error("The sanitized baseline contains no owner email receipt.");
	}
	runSql(`begin;
drop trigger if exists create_profile_for_new_auth_user on auth.users;
create trigger create_profile_for_new_auth_user
	after insert on auth.users
	for each row execute function public.create_profile_for_new_auth_user();

drop trigger if exists record_new_auth_user_marketing_email_consent on auth.users;
create trigger record_new_auth_user_marketing_email_consent
	after insert on auth.users
	for each row execute function public.record_new_auth_user_marketing_email_consent();

update auth.users
set
	email = '${ACCOUNT.email}',
	encrypted_password = extensions.crypt(
		'${ACCOUNT.password}',
		extensions.gen_salt('bf')
	),
	email_confirmed_at = now(),
	confirmation_token = '',
	recovery_token = '',
	email_change_token_new = '',
	email_change = '',
	email_change_token_current = '',
	phone_change = '',
	phone_change_token = '',
	reauthentication_token = '',
	raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
	raw_user_meta_data = jsonb_build_object(
		'display_name', (select display_name from public.profiles where user_id = '${userId}'::uuid),
		'email_verified', true,
		'rehearsal', true
	),
	updated_at = now()
where id = '${userId}'::uuid;

insert into auth.identities (
	id,
	provider_id,
	user_id,
	identity_data,
	provider,
	last_sign_in_at,
	created_at,
	updated_at
)
values (
	gen_random_uuid(),
	'${userId}',
	'${userId}'::uuid,
	jsonb_build_object(
		'sub', '${userId}',
		'email', '${ACCOUNT.email}',
		'email_verified', true,
		'phone_verified', false
	),
	'email',
	now(),
	now(),
	now()
)
on conflict (provider_id, provider) do update
set identity_data = excluded.identity_data, updated_at = now();

insert into public.app_role_assignments (user_id, role, granted_by)
values ('${userId}'::uuid, 'developer'::public.app_role, null)
on conflict (user_id) do update
set role = excluded.role, granted_by = null, updated_at = now();

create or replace function public.claim_rehearsal_owner_persona(
	p_authenticated_user_id uuid,
	p_expected_persona_id uuid,
	p_email_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $claim$
declare
	v_constraint record;
	v_email text;
	v_has_existing_rows boolean;
begin
	if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
		raise exception 'Rehearsal owner claiming requires the local service role';
	end if;
	if p_expected_persona_id <> '${userId}'::uuid
		or p_email_sha256 <> '${baseline.ownerEmailSha256}'
		or p_authenticated_user_id = p_expected_persona_id then
		return false;
	end if;
	select lower(btrim(email)) into v_email
	from auth.users
	where id = p_authenticated_user_id;
	if v_email is null
		or encode(extensions.digest(v_email, 'sha256'), 'hex') <> '${baseline.ownerEmailSha256}'
		or not exists (
			select 1 from auth.identities
			where user_id = p_authenticated_user_id and provider = 'google'
		) then
		return false;
	end if;
	if not exists (
		select 1 from auth.users where id = p_expected_persona_id
	) or not exists (
		select 1 from public.profiles where user_id = p_expected_persona_id
	) then
		-- The matching account already claimed this runtime, or the baseline is no
		-- longer in its expected pre-claim state. A newly issued token already
		-- carries the transferred role, so no repeated mutation is needed.
		return false;
	end if;

	-- Google signup may create only the default rows removed below. Refuse to
	-- overwrite an independently used local account with its own application data.
	for v_constraint in
		select
			ns.nspname as schema_name,
			cls.relname as table_name,
			att.attname as column_name
		from pg_constraint con
		join pg_class cls on cls.oid = con.conrelid
		join pg_namespace ns on ns.oid = cls.relnamespace
		join unnest(con.conkey) with ordinality source_key(attnum, ordinality) on true
		join unnest(con.confkey) with ordinality target_key(attnum, ordinality)
			on target_key.ordinality = source_key.ordinality
		join pg_attribute att on att.attrelid = con.conrelid and att.attnum = source_key.attnum
		join pg_attribute target_att on target_att.attrelid = con.confrelid and target_att.attnum = target_key.attnum
		where con.contype = 'f'
			and con.confrelid = 'auth.users'::regclass
			and target_att.attname = 'id'
			and ns.nspname = 'public'
			and cls.relname not in (
				'profiles',
				'user_marketing_email_preferences',
				'marketing_email_preference_events'
			)
	loop
		execute format(
			'select exists (select 1 from %I.%I where %I = $1)',
			v_constraint.schema_name,
			v_constraint.table_name,
			v_constraint.column_name
		) into v_has_existing_rows using p_authenticated_user_id;
		if v_has_existing_rows then
			return false;
		end if;
	end loop;

	-- Google signup creates a default profile. It has no user activity yet and must
	-- yield to the restored owner snapshot before ownership is transferred.
	delete from public.user_marketing_email_preferences where user_id = p_authenticated_user_id;
	delete from public.marketing_email_preference_events where user_id = p_authenticated_user_id;
	delete from public.profiles where user_id = p_authenticated_user_id;

	for v_constraint in
		select
			ns.nspname as schema_name,
			cls.relname as table_name,
			att.attname as column_name
		from pg_constraint con
		join pg_class cls on cls.oid = con.conrelid
		join pg_namespace ns on ns.oid = cls.relnamespace
		join unnest(con.conkey) with ordinality source_key(attnum, ordinality) on true
		join unnest(con.confkey) with ordinality target_key(attnum, ordinality)
			on target_key.ordinality = source_key.ordinality
		join pg_attribute att on att.attrelid = con.conrelid and att.attnum = source_key.attnum
		join pg_attribute target_att on target_att.attrelid = con.confrelid and target_att.attnum = target_key.attnum
		where con.contype = 'f'
			and con.confrelid = 'auth.users'::regclass
			and target_att.attname = 'id'
			and ns.nspname = 'public'
	loop
		execute format(
			'update %I.%I set %I = $1 where %I = $2',
			v_constraint.schema_name,
			v_constraint.table_name,
			v_constraint.column_name,
			v_constraint.column_name
		) using p_authenticated_user_id, p_expected_persona_id;
	end loop;

	-- Owner-scoped Storage object names contain the restored persona UUID. Keep
	-- every database pointer aligned with the object rename performed below so
	-- the claimed Google account sees the same avatar and private evidence.
	update public.profiles
	set avatar_path = replace(
		avatar_path,
		p_expected_persona_id::text,
		p_authenticated_user_id::text
	)
	where user_id = p_authenticated_user_id
		and avatar_path like p_expected_persona_id::text || '/%';
	update public.profile_image_policy_acceptances
	set avatar_path = replace(
		avatar_path,
		p_expected_persona_id::text,
		p_authenticated_user_id::text
	)
	where user_id = p_authenticated_user_id
		and avatar_path like p_expected_persona_id::text || '/%';
	update public.profile_image_reports
	set avatar_path = replace(
		avatar_path,
		p_expected_persona_id::text,
		p_authenticated_user_id::text
	)
	where reported_profile_user_id = p_authenticated_user_id
		and avatar_path like p_expected_persona_id::text || '/%';
	update public.food_compatibility_feedback
	set evidence_path = replace(
		evidence_path,
		p_expected_persona_id::text,
		p_authenticated_user_id::text
	)
	where reported_by = p_authenticated_user_id
		and evidence_path like p_expected_persona_id::text || '/%';
	update public.shared_product_submissions
	set evidence_paths = replace(
		evidence_paths::text,
		p_expected_persona_id::text,
		p_authenticated_user_id::text
	)::jsonb
	where submitted_by = p_authenticated_user_id
		and evidence_paths::text like '%' || p_expected_persona_id::text || '/%';

	update storage.objects
	set
		owner_id = p_authenticated_user_id::text,
		name = replace(name, p_expected_persona_id::text, p_authenticated_user_id::text)
	where owner_id = p_expected_persona_id::text;
	delete from auth.identities where user_id = p_expected_persona_id;
	delete from auth.users where id = p_expected_persona_id;
	return true;
end
$claim$;
revoke all on function public.claim_rehearsal_owner_persona(uuid, uuid, text)
	from public, anon, authenticated;
grant execute on function public.claim_rehearsal_owner_persona(uuid, uuid, text)
	to service_role;
notify pgrst, 'reload schema';

insert into public.catalog_monitor_settings (id, enabled)
values (true, false)
on conflict (id) do update
set enabled = false, updated_at = now();

update public.food_image_assets
set
	image_url = '${environment.apiUrl}/storage/v1/object/public/food-image-assets/' || storage_path,
	thumbnail_url = '${environment.apiUrl}/storage/v1/object/public/food-image-assets/' || storage_path
where storage_path is not null;
commit;`);

	return {
		message:
			"The exact owner snapshot and Google-claim receipt are configured locally.",
		environmentVariables: {
			BLENDCALC_RUNTIME_ENVIRONMENT: "rehearsal",
			PUBLIC_SITE_URL: "http://localhost:5175",
			PUBLIC_SUPABASE_URL: environment.apiUrl,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.publishableKey,
			SUPABASE_SERVICE_ROLE_KEY: environment.serviceRoleKey,
			BLENDCALC_REHEARSAL_BASELINE_ID: baseline.generationId,
			BLENDCALC_REHEARSAL_ACCOUNT_EMAIL: ACCOUNT.email,
			BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD: ACCOUNT.password,
			BLENDCALC_REHEARSAL_OWNER_PERSONA_ID: userId,
			BLENDCALC_REHEARSAL_OWNER_EMAIL_SHA256: baseline.ownerEmailSha256,
			BLENDCALC_API_READ_MODE: "isolated",
		},
	};
};

export const verifyRuntime = ({ runSql, baseline }) => {
	const proofEmailSha256 = createHash("sha256")
		.update(LOCAL_GOOGLE_PROOF.email)
		.digest("hex");
	if (proofEmailSha256 !== baseline.ownerEmailSha256) {
		return {
			message:
				"The owner-claim boundary is installed; its real Google identity requires owner verification after a production refresh.",
		};
	}
	const personaId = baseline.ownerPersonaUserId;
	runSql(`begin;
insert into auth.users (
	id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data
)
values (
	'${LOCAL_GOOGLE_PROOF.id}'::uuid,
	'authenticated',
	'authenticated',
	'${LOCAL_GOOGLE_PROOF.email}',
	now(),
	'{"provider":"google","providers":["google"]}'::jsonb,
	'{"email_verified":true}'::jsonb
);
insert into auth.identities (
	id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
	gen_random_uuid(),
	'${LOCAL_GOOGLE_PROOF.id}',
	'${LOCAL_GOOGLE_PROOF.id}'::uuid,
	jsonb_build_object(
		'sub', '${LOCAL_GOOGLE_PROOF.id}',
		'email', '${LOCAL_GOOGLE_PROOF.email}',
		'email_verified', true,
		'phone_verified', false
	),
	'google',
	now(),
	now(),
	now()
);
select set_config('request.jwt.claim.role', 'service_role', true);
do $verify_claim$
declare
	v_before_count bigint;
	v_after_count bigint;
	v_before_display_name text;
begin
	select count(item.user_id), max(profile.display_name)
	into v_before_count, v_before_display_name
	from public.profiles profile
	left join public.user_food_list_items item on item.user_id = profile.user_id
	where profile.user_id = '${personaId}'::uuid;
	if not public.claim_rehearsal_owner_persona(
		'${LOCAL_GOOGLE_PROOF.id}'::uuid,
		'${personaId}'::uuid,
		'${baseline.ownerEmailSha256}'
	) then
		raise exception 'The local Google identity could not claim the Rehearsal owner persona';
	end if;
	if exists (select 1 from auth.users where id = '${personaId}'::uuid) then
		raise exception 'The placeholder owner identity survived the claim';
	end if;
	select count(*) into v_after_count
	from public.user_food_list_items
	where user_id = '${LOCAL_GOOGLE_PROOF.id}'::uuid;
	if v_after_count <> v_before_count then
		raise exception 'The claimed owner food-list count changed';
	end if;
	if not exists (
		select 1 from public.profiles
		where user_id = '${LOCAL_GOOGLE_PROOF.id}'::uuid
			and display_name is not distinct from v_before_display_name
	) then
		raise exception 'The claimed owner profile was not preserved';
	end if;
	if public.claim_rehearsal_owner_persona(
		'${LOCAL_GOOGLE_PROOF.id}'::uuid,
		'${personaId}'::uuid,
		'${baseline.ownerEmailSha256}'
	) then
		raise exception 'A completed owner claim was not idempotent';
	end if;
	if not exists (
		select 1 from public.profiles
		where user_id = '${LOCAL_GOOGLE_PROOF.id}'::uuid
			and display_name is not distinct from v_before_display_name
	) then
		raise exception 'A repeated owner claim changed the restored profile';
	end if;
	if exists (
		select 1 from public.profiles
		where avatar_path like '${personaId}/%'
		union all
		select 1 from public.profile_image_policy_acceptances
		where avatar_path like '${personaId}/%'
		union all
		select 1 from public.profile_image_reports
		where avatar_path like '${personaId}/%'
		union all
		select 1 from public.food_compatibility_feedback
		where evidence_path like '${personaId}/%'
		union all
		select 1 from public.shared_product_submissions
		where evidence_paths::text like '%${personaId}/%'
		union all
		select 1 from storage.objects
		where owner_id = '${personaId}'
			or name like '${personaId}/%'
	) then
		raise exception 'An owner Storage pointer retained the placeholder identity';
	end if;
end
$verify_claim$;
rollback;`);
	return {
		message:
			"Verified that a matching local Google identity atomically claims the complete restored owner profile and Storage pointers.",
	};
};
