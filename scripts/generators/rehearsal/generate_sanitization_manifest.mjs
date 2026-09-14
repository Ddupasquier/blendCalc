/**
 * Purpose: Generate or verify the explicit table-and-column Rehearsal sanitization
 * manifest from the isolated local application database schema.
 * Run: `npm run rehearsal:sanitization:generate` or
 * `npm run rehearsal:sanitization:check`.
 */

import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { createCleanProcessEnvironment } from "../../lib/environment/runtime_environment.mjs";
import {
	compileSanitizationManifest,
	serializeSanitizationManifest,
} from "../../lib/rehearsal/sanitization_policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const migrationDirectory = fileURLToPath(
	new URL("../../../supabase/migrations/", import.meta.url),
);
const manifestPath = fileURLToPath(
	new URL(
		"../../../infrastructure/rehearsal/application/sanitization-policy.json",
		import.meta.url,
	),
);
const container = "supabase_db_blendcalc";
const mode = process.argv[2] ?? "--check";

if (!new Set(["--check", "--write"]).has(mode)) {
	throw new Error(
		"Use --check or --write when generating the Rehearsal sanitization manifest.",
	);
}

const inspect = spawnSync(
	"docker",
	["inspect", container, "--format", "{{json .Config.Labels}}"],
	{
		cwd: repositoryRoot,
		encoding: "utf8",
		env: createCleanProcessEnvironment(),
	},
);
if (inspect.status !== 0) {
	throw new Error(
		"The isolated local application Supabase database must be running.",
	);
}
const labels = JSON.parse(inspect.stdout.trim());
if (labels["com.supabase.cli.project"] !== "blendcalc") {
	throw new Error(
		"Refusing a database container that is not the local blendcalc Supabase project.",
	);
}

const schemaQuery = `
select coalesce(json_agg(table_shape order by table_shape->>'name'), '[]'::json)::text
from (
	select json_build_object(
		'name', table_info.table_name,
		'columns', json_agg(json_build_object(
			'name', column_info.column_name,
			'dataType', column_info.data_type,
			'udtName', column_info.udt_name,
			'nullable', column_info.is_nullable = 'YES',
			'hasDefault', column_info.column_default is not null,
			'identity', column_info.is_identity,
			'generated', column_info.is_generated,
			'primaryKey', exists (
				select 1
				from pg_index primary_index
				join pg_class primary_table on primary_table.oid = primary_index.indrelid
				join pg_namespace primary_namespace on primary_namespace.oid = primary_table.relnamespace
				join pg_attribute primary_column
					on primary_column.attrelid = primary_table.oid
					and primary_column.attnum = any(primary_index.indkey)
				where primary_index.indisprimary
					and primary_namespace.nspname = table_info.table_schema
					and primary_table.relname = table_info.table_name
					and primary_column.attname = column_info.column_name
			),
			'characterMaximumLength', column_info.character_maximum_length,
			'numericPrecision', column_info.numeric_precision,
			'numericScale', column_info.numeric_scale,
			'foreignKey', (
				select json_build_object(
					'schema', referenced_namespace.nspname,
					'table', referenced_table.relname,
					'column', referenced_column.attname
				)
				from pg_constraint foreign_key
				join pg_class source_table on source_table.oid = foreign_key.conrelid
				join pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
				join lateral generate_subscripts(foreign_key.conkey, 1) position on true
				join pg_attribute source_column
					on source_column.attrelid = source_table.oid
					and source_column.attnum = foreign_key.conkey[position]
				join pg_class referenced_table on referenced_table.oid = foreign_key.confrelid
				join pg_namespace referenced_namespace on referenced_namespace.oid = referenced_table.relnamespace
				join pg_attribute referenced_column
					on referenced_column.attrelid = referenced_table.oid
					and referenced_column.attnum = foreign_key.confkey[position]
				where foreign_key.contype = 'f'
					and source_namespace.nspname = table_info.table_schema
					and source_table.relname = table_info.table_name
					and source_column.attname = column_info.column_name
				order by foreign_key.oid
				limit 1
			),
			'checkConstraints', coalesce((
				select json_agg(pg_get_constraintdef(check_constraint.oid) order by check_constraint.conname)
				from pg_constraint check_constraint
				join pg_class constrained_table on constrained_table.oid = check_constraint.conrelid
				join pg_namespace constrained_namespace on constrained_namespace.oid = constrained_table.relnamespace
				join pg_attribute constrained_column
					on constrained_column.attrelid = constrained_table.oid
					and constrained_column.attnum = any(check_constraint.conkey)
				where check_constraint.contype = 'c'
					and constrained_namespace.nspname = table_info.table_schema
					and constrained_table.relname = table_info.table_name
					and constrained_column.attname = column_info.column_name
			), '[]'::json),
			'ordinal', column_info.ordinal_position
		) order by column_info.ordinal_position)
	) table_shape
	from information_schema.tables table_info
	join information_schema.columns column_info
		on column_info.table_schema = table_info.table_schema
		and column_info.table_name = table_info.table_name
	where table_info.table_schema = 'public'
		and table_info.table_type = 'BASE TABLE'
	group by table_info.table_name
) inventory;
`;
const schemaResult = spawnSync(
	"docker",
	[
		"exec",
		"--interactive",
		container,
		"psql",
		"--set",
		"ON_ERROR_STOP=1",
		"--no-align",
		"--tuples-only",
		"--username",
		"postgres",
		"--dbname",
		"postgres",
	],
	{
		cwd: repositoryRoot,
		encoding: "utf8",
		env: createCleanProcessEnvironment(),
		input: schemaQuery,
	},
);
if (schemaResult.status !== 0) {
	throw new Error(
		`Could not inventory the local public schema: ${schemaResult.stderr.trim()}`,
	);
}

const migrationNames = (await readdir(migrationDirectory))
	.filter((name) => /^\d{14}_.+\.sql$/u.test(name))
	.sort();
const migrationCutoff = migrationNames.at(-1)?.slice(0, 14);
if (!migrationCutoff)
	throw new Error("No application migration cutoff was found.");

const manifest = compileSanitizationManifest({
	tables: JSON.parse(schemaResult.stdout.trim()),
	migrationCutoff,
});
const serialized = await format(serializeSanitizationManifest(manifest), {
	parser: "json",
	printWidth: 80,
	tabWidth: 2,
	useTabs: true,
});

if (mode === "--write") {
	await mkdir(dirname(manifestPath), { recursive: true });
	await writeFile(manifestPath, serialized, { encoding: "utf8", mode: 0o644 });
	console.log(
		`Wrote ${manifest.tableCount} tables and ${manifest.columnCount} columns to the Rehearsal sanitization manifest.`,
	);
} else {
	let current;
	try {
		current = await readFile(manifestPath, "utf8");
	} catch {
		throw new Error(
			"The Rehearsal sanitization manifest is missing. Generate and review it explicitly.",
		);
	}
	if (current !== serialized) {
		throw new Error(
			"The Rehearsal sanitization manifest does not exactly match the local migration schema. Regenerate it and review every changed classification.",
		);
	}
	console.log(
		`Verified explicit sanitization coverage for ${manifest.tableCount} tables and ${manifest.columnCount} columns.`,
	);
}
