/**
 * Purpose: Prove the proposed Rehearsal export authorization boundary against a
 * disposable local PostgreSQL database. Do not run directly; this module is reusable
 * script infrastructure.
 */

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createCleanProcessEnvironment } from "../environment/runtime_environment.mjs";

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;
const localDatabaseContainer = "supabase_db_blendcalc";
const proofPasswordPrefix = "local-rehearsal-proof-";

export const assertProofIdentifier = (value) => {
	if (!identifierPattern.test(value)) {
		throw new Error(`Unsafe Rehearsal proof identifier: ${value}`);
	}
	return value;
};

const quoteIdentifier = (value) => `"${assertProofIdentifier(value)}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

export const createProofIdentifiers = (
	suffix = randomBytes(5).toString("hex"),
) => {
	if (!/^[a-f0-9]{10}$/u.test(suffix)) {
		throw new Error(
			"The Rehearsal proof suffix must be ten lowercase hex characters.",
		);
	}
	return Object.freeze({
		database: `rehearsal_boundary_${suffix}`,
		ownerRole: `rehearsal_owner_${suffix}`,
		readerRole: `rehearsal_reader_${suffix}`,
		loginRole: `rehearsal_login_${suffix}`,
	});
};

export const buildClusterSetupSql = (
	{ database, ownerRole, readerRole, loginRole },
	password,
) => `
create role ${quoteIdentifier(ownerRole)}
	nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role ${quoteIdentifier(readerRole)}
	nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role ${quoteIdentifier(loginRole)}
	login password ${quoteLiteral(password)}
	nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
grant ${quoteIdentifier(readerRole)} to ${quoteIdentifier(loginRole)}
	with inherit true, set false;
create database ${quoteIdentifier(database)} template template0;
revoke all on database ${quoteIdentifier(database)} from public;
grant connect on database ${quoteIdentifier(database)} to ${quoteIdentifier(loginRole)};
alter role ${quoteIdentifier(loginRole)} in database ${quoteIdentifier(database)}
	set default_transaction_read_only = on;
alter role ${quoteIdentifier(loginRole)} in database ${quoteIdentifier(database)}
	set statement_timeout = '10s';
alter role ${quoteIdentifier(loginRole)} in database ${quoteIdentifier(database)}
	set lock_timeout = '2s';
alter role ${quoteIdentifier(loginRole)} in database ${quoteIdentifier(database)}
	set idle_in_transaction_session_timeout = '10s';
alter role ${quoteIdentifier(loginRole)} in database ${quoteIdentifier(database)}
	set search_path = rehearsal_export, pg_catalog;
`;

export const buildDatabaseSetupSql = ({ ownerRole, readerRole }) => `
revoke all on schema public from public;
grant usage on schema public to ${quoteIdentifier(ownerRole)};

create table public.proof_records (
	id bigint primary key,
	source_key text not null,
	label text not null,
	quantity numeric not null,
	private_note text not null
);
alter table public.proof_records enable row level security;
alter table public.proof_records force row level security;
insert into public.proof_records (id, source_key, label, quantity, private_note)
values
	(1, 'alpha', 'Alpha', 10.5, 'must never be exported'),
	(2, 'beta', 'Beta', 20.25, 'must never be exported');

grant select (id, source_key, label, quantity)
	on public.proof_records to ${quoteIdentifier(ownerRole)};
create policy rehearsal_owner_reads_proof_records
	on public.proof_records
	for select
	to ${quoteIdentifier(ownerRole)}
	using (true);

create table public.proof_side_effect_audit (
	id bigint generated always as identity primary key,
	called_at timestamptz not null default now()
);
alter table public.proof_side_effect_audit enable row level security;
alter table public.proof_side_effect_audit force row level security;

create function public.proof_side_effect()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
	inserted_id bigint;
begin
	insert into public.proof_side_effect_audit default values returning id into inserted_id;
	return inserted_id;
end;
$$;
grant execute on function public.proof_side_effect() to public;

create schema net authorization postgres;
grant usage on schema net to public;
create function net.proof_network_side_effect()
returns bigint
language sql
security definer
set search_path = ''
as $$
	select public.proof_side_effect();
$$;
grant execute on function net.proof_network_side_effect() to public;
revoke usage on schema net from public;

create schema rehearsal_export authorization postgres;
revoke all on schema rehearsal_export from public;
revoke all on all tables in schema rehearsal_export from public;
revoke all on all sequences in schema rehearsal_export from public;
revoke execute on all functions in schema rehearsal_export from public;
alter default privileges for role postgres in schema rehearsal_export
	revoke all on tables from public;
alter default privileges for role postgres in schema rehearsal_export
	revoke all on sequences from public;
alter default privileges for role postgres in schema rehearsal_export
	revoke execute on functions from public;

grant usage, create on schema rehearsal_export to ${quoteIdentifier(ownerRole)};
grant usage on schema rehearsal_export to ${quoteIdentifier(readerRole)};

create view rehearsal_export.proof_records_v1
	with (security_barrier = true, security_invoker = false)
as
	select id, source_key, label, quantity
	from public.proof_records;
revoke all on rehearsal_export.proof_records_v1 from public;
grant select on rehearsal_export.proof_records_v1 to ${quoteIdentifier(readerRole)};
grant ${quoteIdentifier(ownerRole)} to postgres with inherit false, set true;
alter view rehearsal_export.proof_records_v1 owner to ${quoteIdentifier(ownerRole)};
revoke ${quoteIdentifier(ownerRole)} from postgres;
revoke create on schema rehearsal_export from ${quoteIdentifier(ownerRole)};
`;

export const buildClusterInspectionSql = ({
	database,
	ownerRole,
	readerRole,
	loginRole,
}) => `
select concat_ws('|',
	case when not owner.rolcanlogin and not owner.rolsuper and not owner.rolcreatedb
		and not owner.rolcreaterole and not owner.rolreplication and not owner.rolbypassrls
		then 'owner-safe' else 'owner-unsafe' end,
	case when not reader.rolcanlogin and not reader.rolsuper and not reader.rolcreatedb
		and not reader.rolcreaterole and not reader.rolreplication and not reader.rolbypassrls
		then 'reader-safe' else 'reader-unsafe' end,
	case when login.rolcanlogin and not login.rolsuper and not login.rolcreatedb
		and not login.rolcreaterole and not login.rolreplication and not login.rolbypassrls
		then 'login-safe' else 'login-unsafe' end,
	case when not has_database_privilege(${quoteLiteral(loginRole)}, ${quoteLiteral(database)}, 'create')
		and not has_database_privilege(${quoteLiteral(loginRole)}, ${quoteLiteral(database)}, 'temporary')
		then 'database-safe' else 'database-unsafe' end,
	case when not pg_has_role(${quoteLiteral(loginRole)}, ${quoteLiteral(ownerRole)}, 'member')
		then 'owner-unreachable' else 'owner-assumable' end,
	case when exists (
		select 1 from pg_auth_members membership
		where membership.roleid = reader.oid
			and membership.member = login.oid
			and membership.inherit_option
			and not membership.set_option
	) then 'reader-inherited' else 'reader-membership-unsafe' end
)
from pg_roles owner
cross join pg_roles reader
cross join pg_roles login
where owner.rolname = ${quoteLiteral(ownerRole)}
	and reader.rolname = ${quoteLiteral(readerRole)}
	and login.rolname = ${quoteLiteral(loginRole)};
`;

export const buildDatabaseInspectionSql = ({ ownerRole, loginRole }) => `
select concat_ws('|',
	case when has_schema_privilege(${quoteLiteral(loginRole)}, 'rehearsal_export', 'usage')
		then 'export-schema-visible' else 'export-schema-hidden' end,
	case when not has_schema_privilege(${quoteLiteral(loginRole)}, 'public', 'usage')
		and not has_schema_privilege(${quoteLiteral(loginRole)}, 'net', 'usage')
		then 'source-schemas-hidden' else 'source-schema-leak' end,
	case when has_table_privilege(${quoteLiteral(loginRole)}, 'rehearsal_export.proof_records_v1', 'select')
		and not has_table_privilege(${quoteLiteral(loginRole)}, 'rehearsal_export.proof_records_v1', 'insert')
		and not has_table_privilege(${quoteLiteral(loginRole)}, 'rehearsal_export.proof_records_v1', 'update')
		and not has_table_privilege(${quoteLiteral(loginRole)}, 'rehearsal_export.proof_records_v1', 'delete')
		then 'view-read-only' else 'view-privileges-unsafe' end,
	case when has_column_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'id', 'select')
		and has_column_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'source_key', 'select')
		and has_column_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'label', 'select')
		and has_column_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'quantity', 'select')
		and not has_column_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'private_note', 'select')
		and not has_table_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'insert')
		and not has_table_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'update')
		and not has_table_privilege(${quoteLiteral(ownerRole)}, 'public.proof_records', 'delete')
		then 'owner-source-read-only' else 'owner-source-unsafe' end,
	case when not has_table_privilege(${quoteLiteral(loginRole)}, 'public.proof_records', 'select')
		then 'no-direct-table-read' else 'direct-table-read-leak' end,
	case when not has_schema_privilege(${quoteLiteral(ownerRole)}, 'rehearsal_export', 'create')
		then 'owner-cannot-redefine-views' else 'owner-can-redefine-views' end
);
`;

export const buildCleanupSql = ({
	database,
	ownerRole,
	readerRole,
	loginRole,
}) => `
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = ${quoteLiteral(database)}
	and pid <> pg_backend_pid();
drop database if exists ${quoteIdentifier(database)} with (force);
do $cleanup$
begin
	if exists (select 1 from pg_roles where rolname = ${quoteLiteral(ownerRole)}) then
		execute format('revoke %I from postgres', ${quoteLiteral(ownerRole)});
	end if;
end;
$cleanup$;
drop role if exists ${quoteIdentifier(loginRole)};
drop role if exists ${quoteIdentifier(readerRole)};
drop role if exists ${quoteIdentifier(ownerRole)};
`;

const runDockerPsql = ({
	container,
	database,
	user = "postgres",
	password,
	sql,
	expectSuccess = true,
}) => {
	const args = ["exec", "--interactive"];
	if (password) args.push("--env", `PGPASSWORD=${password}`);
	args.push(
		container,
		"psql",
		"--set",
		"ON_ERROR_STOP=1",
		"--no-align",
		"--tuples-only",
	);
	if (password) args.push("--host", "127.0.0.1");
	args.push("--username", user, "--dbname", database);

	const result = spawnSync("docker", args, {
		cwd: process.cwd(),
		encoding: "utf8",
		env: createCleanProcessEnvironment(),
		input: sql,
		stdio: ["pipe", "pipe", "pipe"],
	});
	const output = [result.stdout, result.stderr]
		.filter(Boolean)
		.join("\n")
		.trim();
	if (expectSuccess && result.status !== 0) {
		throw new Error(`Disposable PostgreSQL proof failed:\n${output}`);
	}
	if (!expectSuccess && result.status === 0) {
		throw new Error(
			`Unsafe PostgreSQL operation unexpectedly succeeded: ${sql}`,
		);
	}
	return output;
};

const requireExactOutput = (actual, expected, label) => {
	if (actual.trim() !== expected) {
		throw new Error(
			`${label} returned ${JSON.stringify(actual.trim())}; expected ${JSON.stringify(expected)}.`,
		);
	}
};

const requireDenied = (options, label) => {
	const output = runDockerPsql({ ...options, expectSuccess: false });
	if (
		!/permission denied|must be owner|not allowed to set role/iu.test(output)
	) {
		throw new Error(`${label} failed for an unexpected reason:\n${output}`);
	}
};

export const runRehearsalExportAuthorizationProof = ({
	container = localDatabaseContainer,
} = {}) => {
	const identifiers = createProofIdentifiers();
	const password = `${proofPasswordPrefix}${randomBytes(18).toString("hex")}`;
	let primaryError;
	let cleanupError;

	try {
		runDockerPsql({
			container,
			database: "postgres",
			sql: buildClusterSetupSql(identifiers, password),
		});
		runDockerPsql({
			container,
			database: identifiers.database,
			sql: buildDatabaseSetupSql(identifiers),
		});

		requireExactOutput(
			runDockerPsql({
				container,
				database: "postgres",
				sql: buildClusterInspectionSql(identifiers),
			}),
			"owner-safe|reader-safe|login-safe|database-safe|owner-unreachable|reader-inherited",
			"Cluster privilege inspection",
		);
		requireExactOutput(
			runDockerPsql({
				container,
				database: identifiers.database,
				sql: buildDatabaseInspectionSql(identifiers),
			}),
			"export-schema-visible|source-schemas-hidden|view-read-only|owner-source-read-only|no-direct-table-read|owner-cannot-redefine-views",
			"Database privilege inspection",
		);

		const loginConnection = {
			container,
			database: identifiers.database,
			user: identifiers.loginRole,
			password,
		};
		requireExactOutput(
			runDockerPsql({
				...loginConnection,
				sql: "select current_setting('transaction_read_only'), count(*), min(source_key), max(source_key) from rehearsal_export.proof_records_v1;",
			}),
			"on|2|alpha|beta",
			"Export login read",
		);

		for (const [label, sql] of [
			["direct source read", "select * from public.proof_records;"],
			["source function execution", "select public.proof_side_effect();"],
			[
				"network-schema function execution",
				"select net.proof_network_side_effect();",
			],
			[
				"view mutation after disabling the soft read-only default",
				"set default_transaction_read_only = off; update rehearsal_export.proof_records_v1 set quantity = 0;",
			],
			[
				"export-schema object creation",
				"set default_transaction_read_only = off; create table rehearsal_export.intruder(id integer);",
			],
			[
				"temporary object creation",
				"set default_transaction_read_only = off; create temporary table intruder(id integer);",
			],
			[
				"database object creation",
				"set default_transaction_read_only = off; create schema intruder;",
			],
			[
				"view-owner assumption",
				`set role ${quoteIdentifier(identifiers.ownerRole)};`,
			],
			[
				"view-owner grant",
				`set default_transaction_read_only = off; grant ${quoteIdentifier(identifiers.ownerRole)} to ${quoteIdentifier(identifiers.loginRole)};`,
			],
			[
				"function injection through the view predicate",
				"select * from rehearsal_export.proof_records_v1 where public.proof_side_effect() is null;",
			],
		]) {
			requireDenied({ ...loginConnection, sql }, label);
		}

		requireExactOutput(
			runDockerPsql({
				container,
				database: identifiers.database,
				sql: "select count(*) from public.proof_side_effect_audit;",
			}),
			"0",
			"Side-effect audit",
		);
	} catch (error) {
		primaryError = error;
	} finally {
		try {
			runDockerPsql({
				container,
				database: "postgres",
				sql: buildCleanupSql(identifiers),
			});
		} catch (error) {
			cleanupError = error;
		}
	}

	if (cleanupError) {
		const cleanupMessage =
			cleanupError instanceof Error
				? cleanupError.message
				: String(cleanupError);
		const cleanupFailure = new Error(
			`Rehearsal proof cleanup could not be verified for ${identifiers.database}, ${identifiers.ownerRole}, ${identifiers.readerRole}, and ${identifiers.loginRole}. ${cleanupMessage}`,
			{ cause: cleanupError },
		);
		if (primaryError) {
			throw new AggregateError(
				[primaryError, cleanupFailure],
				"The Rehearsal proof failed and its disposable resources could not be verified as removed.",
			);
		}
		throw cleanupFailure;
	}

	if (primaryError) throw primaryError;
	return {
		checks: 16,
		databaseRemoved: identifiers.database,
		rolesRemoved: [
			identifiers.ownerRole,
			identifiers.readerRole,
			identifiers.loginRole,
		],
	};
};
