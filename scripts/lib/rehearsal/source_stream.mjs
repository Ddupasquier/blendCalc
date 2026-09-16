/**
 * Purpose: Build and parse BlendCalc's consistent, read-only PostgreSQL export stream
 * for its reviewed Rehearsal view manifest. Do not run directly; source selection is
 * project-owned.
 */

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

const quoteIdentifier = (value) => {
	if (!identifierPattern.test(value)) {
		throw new Error(`Unsafe Rehearsal export identifier: ${value}`);
	}
	return `"${value}"`;
};
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
const streamRecordPrefix = "BCREHEARSAL1:";

const encodeStreamRecordSql = (jsonExpression) =>
	`${quoteLiteral(streamRecordPrefix)} || replace(encode(convert_to((${jsonExpression})::text, 'UTF8'), 'base64'), E'\\n', '')`;

export const encodeConsistentExportRecord = (record) =>
	`${streamRecordPrefix}${Buffer.from(JSON.stringify(record), "utf8").toString("base64")}`;

export const expectedExportViews = (manifest) =>
	[
		"migration_history_v1",
		"source_scope_v1",
		...manifest.tables
			.filter((table) => table.sourceRows !== "EXCLUDE")
			.map((table) => `${table.name}_v1`),
	].sort();

export const buildConsistentExportSql = ({
	manifest,
	exportSchema = "rehearsal_export",
}) => {
	if (!Array.isArray(manifest?.tables) || manifest.tables.length === 0) {
		throw new Error(
			"A reviewed Rehearsal manifest is required for extraction.",
		);
	}
	const schema = quoteIdentifier(exportSchema);
	const includedTables = manifest.tables
		.filter((table) => table.sourceRows !== "EXCLUDE")
		.sort((left, right) => left.name.localeCompare(right.name));
	const copyStatements = includedTables.map((table) => {
		quoteIdentifier(table.name);
		const primaryKeys = table.columns
			.filter((column) => column.primaryKey)
			.map((column) => quoteIdentifier(column.name));
		if (primaryKeys.length === 0) {
			throw new Error(
				`Rehearsal export table ${table.name} has no deterministic primary-key order.`,
			);
		}
		const view = quoteIdentifier(`${table.name}_v1`);
		return `copy (
	select ${encodeStreamRecordSql(`json_build_object(
		'kind', 'row',
		'table', ${quoteLiteral(table.name)},
		'row', row_to_json(export_row)
	)`)}
	from ${schema}.${view} export_row
	order by ${primaryKeys.join(", ")}
) to stdout;`;
	});
	const views = expectedExportViews(manifest);
	return `begin transaction isolation level serializable read only deferrable;
set local statement_timeout = '15min';
set local lock_timeout = '2s';
set local idle_in_transaction_session_timeout = '16min';
copy (
	select ${encodeStreamRecordSql(`json_build_object(
		'kind', 'preflight',
		'database', current_database(),
		'role', session_user,
		'transactionReadOnly', current_setting('transaction_read_only')::boolean,
		'roleSafe', coalesce((
			select not role_state.rolsuper
				and not role_state.rolcreatedb
				and not role_state.rolcreaterole
				and not role_state.rolreplication
				and not role_state.rolbypassrls
			from pg_roles role_state
			where role_state.rolname = session_user
		), false),
		'cannotCreateDatabaseObjects', not has_database_privilege(session_user, current_database(), 'create')
			and not has_database_privilege(session_user, current_database(), 'temporary'),
		'exportSchemaVisible', has_schema_privilege(session_user, ${quoteLiteral(exportSchema)}, 'usage'),
		'sourceSchemasHidden', not has_schema_privilege(session_user, 'public', 'usage')
			and not has_schema_privilege(session_user, 'auth', 'usage')
			and not has_schema_privilege(session_user, 'storage', 'usage')
			and not has_schema_privilege(session_user, 'extensions', 'usage'),
		'credentialIsEphemeral', coalesce((
			select role_state.rolvaliduntil is not null
				and role_state.rolvaliduntil > clock_timestamp()
				and role_state.rolvaliduntil <= clock_timestamp() + interval '30 minutes'
			from pg_roles role_state
			where role_state.rolname = session_user
		), false),
		'networkFunctionPathsDenied', current_setting('transaction_read_only')::boolean
			and not exists (
				select 1
				from pg_namespace network_schema
				where network_schema.nspname = 'net'
					and has_schema_privilege(session_user, network_schema.oid, 'usage')
			)
			and not exists (
				select 1
				from pg_proc network_function
				join pg_namespace network_schema
					on network_schema.oid = network_function.pronamespace
				where network_schema.nspname = 'net'
					and has_function_privilege(session_user, network_function.oid, 'execute')
			),
		'ownerUnreachable', not pg_has_role(session_user, 'rehearsal_export_owner', 'set'),
		'ownerUserId', (select owner_user_id from rehearsal_export.source_scope_v1),
		'ownerEmailSha256', (select owner_email_sha256 from rehearsal_export.source_scope_v1),
		'migrationHistory', (
			select coalesce(json_agg(json_build_object(
				'version', version,
				'name', name,
				'statementCount', statement_count,
				'statementSha256', statement_sha256
			) order by version), '[]'::json)
			from rehearsal_export.migration_history_v1
		),
		'views', array(
			select table_name
			from information_schema.views
			where table_schema = ${quoteLiteral(exportSchema)}
				and has_table_privilege(current_user, quote_ident(table_schema) || '.' || quote_ident(table_name), 'select')
			order by table_name
		)
	)`)}
) to stdout;
${copyStatements.join("\n")}
copy (
	select ${encodeStreamRecordSql(`json_build_object(
		'kind', 'complete',
		'transactionReadOnly', current_setting('transaction_read_only')::boolean
	)`)}
) to stdout;
commit;
-- expected export views: ${views.join(",")}
`;
};

export const assertSourcePreflight = ({
	preflight,
	expectedDatabase,
	expectedRole,
	expectedViews,
	expectedOwnerUserId,
	expectedOwnerEmailSha256,
	requireEphemeralCredential = false,
}) => {
	const failedInvariants = [
		["recordType", preflight?.kind === "preflight"],
		["database", preflight?.database === expectedDatabase],
		["role", preflight?.role === expectedRole],
		["transactionReadOnly", preflight?.transactionReadOnly === true],
		["roleSafe", preflight?.roleSafe === true],
		[
			"cannotCreateDatabaseObjects",
			preflight?.cannotCreateDatabaseObjects === true,
		],
		["exportSchemaVisible", preflight?.exportSchemaVisible === true],
		["sourceSchemasHidden", preflight?.sourceSchemasHidden === true],
		[
			"networkFunctionPathsDenied",
			preflight?.networkFunctionPathsDenied === true,
		],
		[
			"credentialIsEphemeral",
			!requireEphemeralCredential || preflight?.credentialIsEphemeral === true,
		],
		["ownerUnreachable", preflight?.ownerUnreachable === true],
		[
			"ownerUserIdFormat",
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
				preflight?.ownerUserId ?? "",
			),
		],
		[
			"ownerEmailReceiptFormat",
			/^[a-f0-9]{64}$/u.test(preflight?.ownerEmailSha256 ?? ""),
		],
		[
			"ownerUserId",
			expectedOwnerUserId === undefined ||
				preflight?.ownerUserId === expectedOwnerUserId,
		],
		[
			"ownerEmailReceipt",
			expectedOwnerEmailSha256 === undefined ||
				preflight?.ownerEmailSha256 === expectedOwnerEmailSha256,
		],
	]
		.filter(([, passed]) => !passed)
		.map(([name]) => name);
	if (failedInvariants.length > 0) {
		throw new Error(
			`The Rehearsal source authorization preflight failed closed: ${failedInvariants.join(", ")}.`,
		);
	}
	if (
		!Array.isArray(preflight.views) ||
		preflight.views.join("\0") !== [...expectedViews].sort().join("\0")
	) {
		throw new Error("The Rehearsal source export-view manifest is not exact.");
	}
	return preflight;
};

export async function* parseConsistentExportLines({
	lines,
	expectedDatabase,
	expectedRole,
	expectedViews,
	expectedOwnerUserId,
	expectedOwnerEmailSha256,
	requireEphemeralCredential = false,
	onPreflight,
}) {
	let preflightSeen = false;
	let completeSeen = false;
	for await (const line of lines) {
		if (!line.trim()) continue;
		if (!line.startsWith(streamRecordPrefix)) {
			throw new Error(
				"The Rehearsal source emitted an invalid record envelope.",
			);
		}
		let record;
		try {
			const encoded = line.slice(streamRecordPrefix.length);
			if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) {
				throw new Error("The Rehearsal source record is not valid base64.");
			}
			record = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
		} catch (error) {
			throw new Error("The Rehearsal source emitted non-JSON content.", {
				cause: error,
			});
		}
		if (!preflightSeen) {
			assertSourcePreflight({
				preflight: record,
				expectedDatabase,
				expectedRole,
				expectedViews,
				expectedOwnerUserId,
				expectedOwnerEmailSha256,
				requireEphemeralCredential,
			});
			if (onPreflight) await onPreflight(record);
			preflightSeen = true;
			continue;
		}
		if (record.kind === "complete") {
			if (record.transactionReadOnly !== true || completeSeen) {
				throw new Error("The Rehearsal source completion receipt is invalid.");
			}
			completeSeen = true;
			continue;
		}
		if (completeSeen || record.kind !== "row") {
			throw new Error("The Rehearsal source stream order is invalid.");
		}
		yield { table: record.table, row: record.row };
	}
	if (!preflightSeen || !completeSeen) {
		throw new Error(
			"The Rehearsal source stream ended without complete receipts.",
		);
	}
}
