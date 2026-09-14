/**
 * Purpose: Build the bounded PostgreSQL restore program for a verified sanitized
 * Rehearsal baseline. Do not run directly; this module is reusable script infrastructure.
 */

import { createHash } from "node:crypto";

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;
const constraintFailurePattern =
	/^ERROR:\s+(?:[A-Z0-9]{5}:\s+)?new row for relation "([a-z][a-z0-9_]*)" violates check constraint "([a-z][a-z0-9_]*)"$/mu;
const sqlStatePattern = /^ERROR:\s+([A-Z0-9]{5}):/mu;
const notNullFailurePattern =
	/^ERROR:\s+(?:23502:\s+)?null value in column "([a-z][a-z0-9_]*)" of relation "([a-z][a-z0-9_]*)" violates not-null constraint$/mu;
const quoteIdentifier = (value) => {
	if (!identifierPattern.test(value)) {
		throw new Error(`Unsafe Rehearsal restore identifier: ${value}`);
	}
	return `"${value}"`;
};
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

const includedPolicies = (manifest) =>
	manifest.tables
		.filter((table) => table.sourceRows !== "EXCLUDE")
		.sort((left, right) => left.name.localeCompare(right.name));

export const summarizeRestoreError = (stderr) => {
	const match = String(stderr).match(constraintFailurePattern);
	if (match) return `Sanitized data violated ${match[1]}.${match[2]}.`;
	const notNull = String(stderr).match(notNullFailurePattern);
	if (notNull) {
		return `Sanitized data omitted required column ${notNull[2]}.${notNull[1]}.`;
	}
	const sqlState = String(stderr).match(sqlStatePattern)?.[1];
	return sqlState
		? `PostgreSQL rejected the sanitized baseline stream with SQLSTATE ${sqlState}; row details were withheld.`
		: "PostgreSQL rejected the sanitized baseline stream; row details were withheld.";
};

export const encodeBaselineRecordForCopy = (line) => {
	let record;
	try {
		record = JSON.parse(line.trimEnd());
	} catch (error) {
		throw new Error("A Rehearsal baseline record is not valid JSON.", {
			cause: error,
		});
	}
	if (
		!identifierPattern.test(record?.table ?? "") ||
		!record.row ||
		typeof record.row !== "object" ||
		Array.isArray(record.row)
	) {
		throw new Error(
			"A Rehearsal baseline record has an invalid restore shape.",
		);
	}
	return `${record.table}\t${Buffer.from(JSON.stringify(record.row), "utf8").toString("base64")}`;
};

export const buildRestoreSqlPrefix = () => `\\set ON_ERROR_STOP on
\\set VERBOSITY verbose
begin;
set local session_replication_role = replica;
create temporary table rehearsal_restore_rows (
	sequence bigint generated always as identity primary key,
	table_name text not null,
	encoded text not null
) on commit drop;
copy rehearsal_restore_rows (table_name, encoded) from stdin;
`;

const decodedPayloadSql =
	"convert_from(decode(source.encoded, 'base64'), 'UTF8')::jsonb";

const authReferenceSelects = (manifest) =>
	includedPolicies(manifest).flatMap((table) =>
		table.columns
			.filter(
				(column) =>
					column.action !== "EXCLUDE" &&
					column.foreignKey?.schema === "auth" &&
					column.foreignKey?.table === "users" &&
					column.foreignKey?.column === "id",
			)
			.map(
				(
					column,
				) => `select nullif(${decodedPayloadSql}->>${quoteLiteral(column.name)}, '')::uuid as id
	from rehearsal_restore_rows source
	where source.table_name = ${quoteLiteral(table.name)}`,
			),
	);

const buildAuthRestoreSql = (manifest) => {
	const selects = authReferenceSelects(manifest);
	if (selects.length === 0) return "";
	return `with referenced_auth_users as (
	${selects.join("\n\tunion\n\t")}
)
insert into auth.users (
	instance_id,
	id,
	aud,
	role,
	email,
	confirmation_token,
	recovery_token,
	email_change_token_new,
	email_change,
	email_change_token_current,
	phone_change,
	phone_change_token,
	reauthentication_token,
	raw_app_meta_data,
	raw_user_meta_data,
	is_sso_user,
	is_anonymous,
	created_at,
	updated_at
)
select distinct
	'00000000-0000-0000-0000-000000000000'::uuid,
	id,
	'authenticated',
	'authenticated',
	'rehearsal-' || replace(id::text, '-', '') || '@rehearsal.invalid',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'',
	'{"provider":"email","providers":["email"]}'::jsonb,
	'{"rehearsal":true}'::jsonb,
	false,
	false,
	now(),
	now()
from referenced_auth_users
where id is not null
on conflict (id) do nothing;
`;
};

const buildTableRestoreSql = (table) => {
	const tableName = quoteIdentifier(table.name);
	const columns = table.columns.filter(
		(column) => column.action !== "EXCLUDE" && column.generated !== "ALWAYS",
	);
	if (columns.length === 0) return "";
	const columnList = columns
		.map((column) => quoteIdentifier(column.name))
		.join(", ");
	const selectedColumns = columns
		.map((column) => `restored.${quoteIdentifier(column.name)}`)
		.join(", ");
	const overridesIdentity = columns.some((column) => column.identity === "YES")
		? " overriding system value"
		: "";
	return `insert into public.${tableName} (${columnList})${overridesIdentity}
select ${selectedColumns}
from rehearsal_restore_rows source
cross join lateral jsonb_populate_record(
	null::public.${tableName},
	${decodedPayloadSql}
) restored
where source.table_name = ${quoteLiteral(table.name)}
order by source.sequence;
`;
};

const buildIdentitySequenceSql = (table) =>
	table.columns
		.filter(
			(column) =>
				column.action !== "EXCLUDE" &&
				column.identity === "YES" &&
				column.generated !== "ALWAYS",
		)
		.map((column) => {
			const relation = `public.${quoteIdentifier(table.name)}`;
			const columnName = quoteIdentifier(column.name);
			return `select setval(
	pg_get_serial_sequence(${quoteLiteral(`public.${table.name}`)}, ${quoteLiteral(column.name)}),
	coalesce((select max(${columnName}) from ${relation}), 1),
	exists(select 1 from ${relation})
);`;
		})
		.join("\n");

const buildRowCountChecks = (tableCounts) =>
	Object.entries(tableCounts)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([table, expected]) => {
			quoteIdentifier(table);
			if (!Number.isSafeInteger(expected) || expected < 0) {
				throw new Error(`Invalid Rehearsal row count for ${table}.`);
			}
			return `if (select count(*) from public.${quoteIdentifier(table)}) <> ${expected} then
		raise exception 'Rehearsal row-count mismatch for ${table}';
	end if;`;
		})
		.join("\n\t");

const buildForeignKeyChecks = (manifest) =>
	includedPolicies(manifest)
		.flatMap((table) =>
			table.columns
				.filter((column) => column.action !== "EXCLUDE" && column.foreignKey)
				.map((column) => ({ table, column })),
		)
		.map(({ table, column }) => {
			const target = column.foreignKey;
			for (const value of [
				table.name,
				column.name,
				target.schema,
				target.table,
				target.column,
			])
				quoteIdentifier(value);
			return `if exists (
		select 1
		from public.${quoteIdentifier(table.name)} child
		left join ${quoteIdentifier(target.schema)}.${quoteIdentifier(target.table)} parent
			on parent.${quoteIdentifier(target.column)} = child.${quoteIdentifier(column.name)}
		where child.${quoteIdentifier(column.name)} is not null
			and parent.${quoteIdentifier(target.column)} is null
	) then
		raise exception 'Rehearsal foreign-key mismatch for ${table.name}.${column.name}';
	end if;`;
		})
		.join("\n\t");

export const buildRestoreSqlSuffix = ({ manifest, tableCounts }) => {
	if (!Array.isArray(manifest?.tables) || !tableCounts) {
		throw new Error("A reviewed manifest and exact row counts are required.");
	}
	const tables = includedPolicies(manifest);
	const expectedNames = tables.map((table) => table.name).sort();
	if (expectedNames.join("\0") !== Object.keys(tableCounts).sort().join("\0")) {
		throw new Error("Rehearsal restore table counts do not match the policy.");
	}
	return `\\.
create index rehearsal_restore_rows_table_name_idx
	on rehearsal_restore_rows (table_name, sequence);
truncate table ${manifest.tables
		.map((table) => `public.${quoteIdentifier(table.name)}`)
		.join(", ")}
restart identity cascade;
${buildAuthRestoreSql(manifest)}
${tables.map(buildTableRestoreSql).join("\n")}
${tables.map(buildIdentitySequenceSql).filter(Boolean).join("\n")}
set local session_replication_role = origin;
do $rehearsal_checks$
begin
	${buildRowCountChecks(tableCounts)}
	${buildForeignKeyChecks(manifest)}
end
$rehearsal_checks$;
commit;
`;
};

export const createCandidateMigrationReceipt = ({
	baselineManifest,
	currentFiles,
}) => {
	const baselineEntries = Object.entries(
		baselineManifest?.migrations ?? {},
	).sort(([left], [right]) => left.localeCompare(right));
	if (baselineEntries.length === 0) {
		throw new Error("The active Rehearsal baseline has no migration bundle.");
	}
	if (baselineEntries.length > currentFiles.length) {
		throw new Error(
			"The active Rehearsal history is absent from local source.",
		);
	}
	for (let index = 0; index < baselineEntries.length; index += 1) {
		const [filename, receipt] = baselineEntries[index];
		const current = currentFiles[index];
		if (
			current.filename !== filename ||
			current.fileSha256 !== receipt.sha256
		) {
			throw new Error(
				`Local migration history diverges from the active baseline at ${filename}.`,
			);
		}
	}
	const candidates = currentFiles.slice(baselineEntries.length);
	const candidateSha256 = createHash("sha256")
		.update(
			`${JSON.stringify(
				candidates.map(({ filename, fileSha256 }) => ({
					filename,
					fileSha256,
				})),
				null,
				"\t",
			)}\n`,
		)
		.digest("hex");
	return { candidates, candidateSha256 };
};
