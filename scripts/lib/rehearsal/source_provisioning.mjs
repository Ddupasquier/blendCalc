/**
 * Purpose: Build the bounded SQL and environment records used to provision a
 * dedicated Rehearsal source without embedding project credentials in tracked code.
 * Do not run directly; this module is reusable Rehearsal infrastructure.
 */

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROLE_PATTERN = /^rehearsal_[a-z0-9_]+$/u;
const PROJECT_REFERENCE_PATTERN = /^[a-z0-9]{20}$/u;

const quoteLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;
const quoteIdentifier = (value) => {
	if (!ROLE_PATTERN.test(value)) {
		throw new Error(`Unsafe Rehearsal source role: ${value}.`);
	}
	return `"${value}"`;
};

const assertOwner = ({ ownerUserId, ownerEmailSha256 }) => {
	if (!UUID_PATTERN.test(ownerUserId)) {
		throw new Error("The Rehearsal source owner UUID is invalid.");
	}
	if (!SHA256_PATTERN.test(ownerEmailSha256)) {
		throw new Error("The Rehearsal source owner email receipt is invalid.");
	}
};

export const selectRehearsalSourceOwner = ({ assignments, usersById }) => {
	const eligibleAssignments = assignments.filter((assignment) =>
		new Set(["admin", "developer"]).has(assignment.role),
	);
	if (eligibleAssignments.length !== 1) {
		throw new Error(
			`Rehearsal source provisioning requires exactly one admin or developer owner; found ${eligibleAssignments.length}.`,
		);
	}
	const assignment = eligibleAssignments[0];
	const user = usersById.get(assignment.user_id);
	if (!user?.email) {
		throw new Error("The approved Rehearsal source owner has no Auth email.");
	}
	if (!user.identities?.some((identity) => identity.provider === "google")) {
		throw new Error(
			"The approved Rehearsal source owner is not linked to Google Auth.",
		);
	}
	return Object.freeze({ assignment, user });
};

export const buildRehearsalSourceProvisioningSql = ({
	loginRole = "rehearsal_source",
	databasePassword,
	credentialValidUntil,
	ownerUserId,
	ownerEmailSha256,
}) => {
	const role = quoteIdentifier(loginRole);
	if (!/^[a-f0-9]{48,128}$/u.test(databasePassword)) {
		throw new Error(
			"The Rehearsal source database password must be generated hexadecimal data.",
		);
	}
	const validUntil = new Date(credentialValidUntil);
	const remainingMilliseconds = validUntil.getTime() - Date.now();
	if (
		Number.isNaN(validUntil.getTime()) ||
		remainingMilliseconds <= 0 ||
		remainingMilliseconds > 30 * 60 * 1000
	) {
		throw new Error(
			"The Rehearsal source database credential must expire within 30 minutes.",
		);
	}
	assertOwner({ ownerUserId, ownerEmailSha256 });
	return `begin;
do $create_rehearsal_source$
begin
	if not exists (select 1 from pg_roles where rolname = ${quoteLiteral(loginRole)}) then
		create role ${role}
			login password ${quoteLiteral(databasePassword)}
			nocreatedb nocreaterole inherit;
	elsif exists (
		select 1 from pg_roles
		where rolname = ${quoteLiteral(loginRole)}
			and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
	) then
		raise exception 'The existing Rehearsal source login has unsafe role attributes';
	else
		alter role ${role}
			login password ${quoteLiteral(databasePassword)}
			nocreatedb nocreaterole inherit;
	end if;
end
$create_rehearsal_source$;
alter role ${role} reset all;
alter role ${role} valid until ${quoteLiteral(validUntil.toISOString())};
revoke all on database postgres from ${role};
grant connect on database postgres to ${role};
revoke all on schema public, auth, storage, extensions, net, rehearsal_export from ${role};
revoke all on all tables in schema public, auth, storage, extensions, net, rehearsal_export from ${role};
revoke all on all sequences in schema public, auth, storage, extensions, net, rehearsal_export from ${role};
revoke execute on all functions in schema public, auth, storage, extensions, net, rehearsal_export from ${role};
grant rehearsal_export_reader to ${role} with inherit true, set false;
alter role ${role} in database postgres set default_transaction_read_only = on;
alter role ${role} in database postgres set statement_timeout = '15min';
alter role ${role} in database postgres set lock_timeout = '2s';
alter role ${role} in database postgres set idle_in_transaction_session_timeout = '16min';
alter role ${role} in database postgres set search_path = rehearsal_export, pg_catalog;
insert into rehearsal_export.source_scopes (
	login_role,
	owner_user_id,
	owner_email_sha256
)
values (
	${quoteLiteral(loginRole)},
	${quoteLiteral(ownerUserId)}::uuid,
	${quoteLiteral(ownerEmailSha256)}
)
on conflict (login_role) do update
set owner_user_id = excluded.owner_user_id,
	owner_email_sha256 = excluded.owner_email_sha256;
do $verify_rehearsal_source$
declare
	login_oid oid := (select oid from pg_roles where rolname = ${quoteLiteral(loginRole)});
begin
	if login_oid is null or exists (
		select 1 from pg_roles
		where oid = login_oid
			and (not rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
	) then
		raise exception 'The Rehearsal source login has unsafe role attributes';
	end if;
	if exists (
		select 1
		from pg_auth_members membership
		where membership.member = login_oid
			and membership.roleid <> (select oid from pg_roles where rolname = 'rehearsal_export_reader')
	) then
		raise exception 'The Rehearsal source login has an unexpected role membership';
	end if;
	if not exists (
		select 1
		from pg_auth_members membership
		where membership.member = login_oid
			and membership.roleid = (select oid from pg_roles where rolname = 'rehearsal_export_reader')
			and membership.inherit_option
			and not membership.set_option
	) then
		raise exception 'The Rehearsal source reader membership is unsafe';
	end if;
	if has_database_privilege(${quoteLiteral(loginRole)}, 'postgres', 'create')
		or has_database_privilege(${quoteLiteral(loginRole)}, 'postgres', 'temporary')
		or has_schema_privilege(${quoteLiteral(loginRole)}, 'public', 'usage')
		or has_schema_privilege(${quoteLiteral(loginRole)}, 'auth', 'usage')
		or has_schema_privilege(${quoteLiteral(loginRole)}, 'storage', 'usage')
		or has_schema_privilege(${quoteLiteral(loginRole)}, 'extensions', 'usage')
		or not has_schema_privilege(${quoteLiteral(loginRole)}, 'rehearsal_export', 'usage')
		or pg_has_role(${quoteLiteral(loginRole)}, 'rehearsal_export_owner', 'set') then
		raise exception 'The Rehearsal source login has unsafe database privileges';
	end if;
	if not exists (
		select 1 from pg_roles
		where rolname = ${quoteLiteral(loginRole)}
			and rolvaliduntil = ${quoteLiteral(validUntil.toISOString())}::timestamptz
	) then
		raise exception 'The Rehearsal source login is not ephemeral';
	end if;
	if not exists (
		select 1 from rehearsal_export.source_scopes
		where login_role = ${quoteLiteral(loginRole)}::name
			and owner_user_id = ${quoteLiteral(ownerUserId)}::uuid
			and owner_email_sha256 = ${quoteLiteral(ownerEmailSha256)}
	) then
		raise exception 'The Rehearsal source owner scope is not exact';
	end if;
end
$verify_rehearsal_source$;
commit;
select json_build_object('provisioned', true, 'loginRole', ${quoteLiteral(loginRole)});
`;
};

export const buildRehearsalStorageBindingSql = ({
	storageUserId,
	storageEmail,
	ownerUserId,
}) => {
	if (!UUID_PATTERN.test(storageUserId) || !UUID_PATTERN.test(ownerUserId)) {
		throw new Error("The Rehearsal Storage identity UUID is invalid.");
	}
	if (typeof storageEmail !== "string" || !storageEmail.includes("@")) {
		throw new Error("The Rehearsal Storage identity email is invalid.");
	}
	return `begin;
update auth.users
set role = 'rehearsal_storage_reader',
	raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
		'rehearsal_purpose', 'production_source_storage_reader',
		'rehearsal_owner_user_id', ${quoteLiteral(ownerUserId)}
	)
where id = ${quoteLiteral(storageUserId)}::uuid
	and lower(email) = lower(${quoteLiteral(storageEmail)});
delete from public.profiles where user_id = ${quoteLiteral(storageUserId)}::uuid;
do $verify_rehearsal_storage$
begin
	if not exists (
		select 1 from auth.users
		where id = ${quoteLiteral(storageUserId)}::uuid
			and lower(email) = lower(${quoteLiteral(storageEmail)})
			and role = 'rehearsal_storage_reader'
			and raw_app_meta_data ->> 'rehearsal_purpose' = 'production_source_storage_reader'
			and raw_app_meta_data ->> 'rehearsal_owner_user_id' = ${quoteLiteral(ownerUserId)}
	) or exists (
		select 1 from public.profiles where user_id = ${quoteLiteral(storageUserId)}::uuid
	) then
		raise exception 'The Rehearsal Storage identity binding is incomplete';
	end if;
end
$verify_rehearsal_storage$;
commit;
select json_build_object('bound', true);
`;
};

export const buildRehearsalSourceDeprovisioningSql = ({
	loginRole = "rehearsal_source",
} = {}) => {
	const role = quoteIdentifier(loginRole);
	return `begin;
delete from rehearsal_export.source_scopes
where login_role = ${quoteLiteral(loginRole)}::name;
do $deprovision_rehearsal_source$
begin
	if exists (select 1 from pg_roles where rolname = ${quoteLiteral(loginRole)}) then
		if exists (
			select 1
			from pg_class relation
			where relation.relowner = (select oid from pg_roles where rolname = ${quoteLiteral(loginRole)})
		) or exists (
			select 1
			from pg_proc routine
			where routine.proowner = (select oid from pg_roles where rolname = ${quoteLiteral(loginRole)})
		) or exists (
			select 1
			from pg_namespace namespace
			where namespace.nspowner = (select oid from pg_roles where rolname = ${quoteLiteral(loginRole)})
		) then
			raise exception 'The Rehearsal source login unexpectedly owns database objects';
		end if;
		alter role ${role} nologin;
		revoke rehearsal_export_reader from ${role};
		revoke all on database postgres from ${role};
		drop role ${role};
	end if;
end
$deprovision_rehearsal_source$;
do $verify_rehearsal_source_removed$
begin
	if exists (select 1 from pg_roles where rolname = ${quoteLiteral(loginRole)})
		or exists (
			select 1 from rehearsal_export.source_scopes
			where login_role = ${quoteLiteral(loginRole)}::name
		) then
		raise exception 'The Rehearsal source database identity was not fully removed';
	end if;
end
$verify_rehearsal_source_removed$;
commit;
select json_build_object('deprovisioned', true, 'loginRole', ${quoteLiteral(loginRole)});
`;
};

export const createRehearsalSourceDatabaseUrl = ({
	poolerUrl,
	projectReference,
	loginRole = "rehearsal_source",
	databasePassword,
}) => {
	if (!PROJECT_REFERENCE_PATTERN.test(projectReference)) {
		throw new Error("The linked Supabase project reference is invalid.");
	}
	quoteIdentifier(loginRole);
	const url = new URL(poolerUrl);
	if (
		url.protocol !== "postgresql:" ||
		!url.hostname.endsWith(".pooler.supabase.com") ||
		url.port !== "5432" ||
		url.pathname !== "/postgres"
	) {
		throw new Error("The linked Supabase session-pooler URL is invalid.");
	}
	const linkedProjectReference = decodeURIComponent(url.username).split(".")[1];
	if (linkedProjectReference !== projectReference) {
		throw new Error("The linked Supabase pooler belongs to another project.");
	}
	url.username = `${loginRole}.${projectReference}`;
	url.password = databasePassword;
	url.searchParams.set("sslmode", "require");
	return url.toString();
};

export const createRehearsalSourceEnvironment = ({
	databaseUrl,
	storageUrl,
	publishableKey,
	storageAccessToken,
	storageRefreshToken,
}) => {
	for (const [label, value] of Object.entries({
		databaseUrl,
		storageUrl,
		publishableKey,
		storageAccessToken,
		storageRefreshToken,
	})) {
		if (!String(value ?? "").trim()) {
			throw new Error(`The Rehearsal source ${label} is missing.`);
		}
	}
	return [
		`REHEARSAL_SOURCE_DATABASE_URL=${databaseUrl}`,
		`REHEARSAL_SOURCE_STORAGE_URL=${storageUrl}`,
		`REHEARSAL_SOURCE_STORAGE_PUBLISHABLE_KEY=${publishableKey}`,
		`REHEARSAL_SOURCE_STORAGE_ACCESS_TOKEN=${storageAccessToken}`,
		`REHEARSAL_SOURCE_STORAGE_REFRESH_TOKEN=${storageRefreshToken}`,
		"",
	].join("\n");
};
