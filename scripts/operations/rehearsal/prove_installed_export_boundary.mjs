/**
 * Purpose: Exercise the installed Rehearsal export views through a disposable login,
 * stream every local source row through the sanitizer, verify an atomic baseline, and
 * remove all proof artifacts.
 * Run: `npm run db:rehearsal:prove-installed-boundary` against local Supabase only.
 */

import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
	createAndActivateBaseline,
	removeBaselineArtifactRoot,
	verifyActiveBaseline,
} from "@rehearsal/db/baseline";
import { createCleanProcessEnvironment } from "../../lib/environment/runtime_environment.mjs";
import {
	createSanitizationContext,
	sanitizeRecordStream,
} from "../../lib/rehearsal/sanitizer.mjs";
import {
	buildConsistentExportSql,
	expectedExportViews,
	parseConsistentExportLines,
} from "../../lib/rehearsal/source_stream.mjs";
import {
	createMigrationReplayReceipt,
	readMigrationSourceBundle,
} from "@rehearsal/db/migrations";
import { readLocalSupabaseEnvironment } from "../../lib/environment/local_supabase.mjs";
import {
	createStorageAssetInventory,
	streamAuthorizedStorageAssets,
} from "../../lib/rehearsal/source_assets.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const applicationMigrations = new URL(
	"../../../supabase/migrations/",
	import.meta.url,
);
const manifestPath = fileURLToPath(
	new URL(
		"../../../infrastructure/rehearsal/application/sanitization-policy.json",
		import.meta.url,
	),
);
const container = "supabase_db_blendcalc";
const suffix = randomBytes(5).toString("hex");
const loginRole = `rehearsal_installed_${suffix}`;
const password = `local-installed-boundary-${randomBytes(18).toString("hex")}`;
const storageEmail = `rehearsal-storage-${suffix}@blendcalc.local`;
const storagePassword = `local-storage-boundary-${randomBytes(18).toString("hex")}`;
const quoteIdentifier = (value) => `"${value}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
const localOwnerEmail = "rehearsal-google-owner@blendcalc.local";

const runContainerPsql = ({ user, sql }) => {
	const result = spawnSync(
		"docker",
		[
			"exec",
			"--interactive",
			container,
			"psql",
			"--set",
			"ON_ERROR_STOP=1",
			"--quiet",
			"--no-align",
			"--tuples-only",
			"--username",
			user,
			"--dbname",
			"postgres",
		],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
			env: createCleanProcessEnvironment(),
			input: sql,
		},
	);
	if (result.status !== 0 || result.error) {
		throw new Error(
			`Local installed-boundary administration failed: ${result.error?.message ?? result.stderr.trim()}`,
		);
	}
	return result.stdout.trim();
};

const manifestSource = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
const retainLocalBaseline = process.argv.includes("--retain-local-baseline");
const includedTables = manifest.tables
	.filter((table) => table.sourceRows !== "EXCLUDE")
	.map((table) => table.name);
const artifactParent = retainLocalBaseline
	? repositoryRoot
	: await mkdtemp(join(tmpdir(), "blendcalc-installed-rehearsal-"));
const artifactRoot = join(artifactParent, ".rehearsal");
let context;
let primaryError;
let cleanupError;
let exportChild;
let exportCompletion;
let sourceEnvironment;
let sourceAdminClient;
let storageUserId;
let storageProofPath;

try {
	// Supabase's local pg_net bootstrap may restore PUBLIC function grants after a
	// restart. The production credential-provisioning step needs the same elevated
	// hardening operation; the export preflight below independently verifies it.
	runContainerPsql({
		user: "supabase_admin",
		sql: `revoke usage on schema net from public;
revoke execute on all functions in schema net from public;`,
	});
	const ownerSourceUserId = runContainerPsql({
		user: "postgres",
		sql: `select profile.user_id
from public.profiles profile
order by
	(select count(*) from public.user_food_list_items item where item.user_id = profile.user_id) desc,
	(select count(*) from public.saved_drinks drink where drink.user_id = profile.user_id) desc,
	(select count(*) from public.custom_foods food where food.user_id = profile.user_id) desc,
	profile.user_id
limit 1;`,
	});
	if (!/^[0-9a-f-]{36}$/u.test(ownerSourceUserId)) {
		throw new Error("The source has no approved Rehearsal owner profile.");
	}
	const ownerEmailSha256 = createHash("sha256")
		.update(localOwnerEmail.trim().toLowerCase())
		.digest("hex");
	context = createSanitizationContext({
		ownerSourceUserId,
		ownerEmailSha256,
	});
	runContainerPsql({
		user: "postgres",
		sql: `
create role ${quoteIdentifier(loginRole)}
	login password ${quoteLiteral(password)}
	nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
grant rehearsal_export_reader to ${quoteIdentifier(loginRole)}
	with inherit true, set false;
alter role ${quoteIdentifier(loginRole)} in database postgres
	set default_transaction_read_only = on;
alter role ${quoteIdentifier(loginRole)} in database postgres
	set search_path = rehearsal_export, pg_catalog;
insert into rehearsal_export.source_scopes (
	login_role,
	owner_user_id,
	owner_email_sha256
)
values (
	${quoteLiteral(loginRole)},
	${quoteLiteral(ownerSourceUserId)}::uuid,
	${quoteLiteral(ownerEmailSha256)}
);
`,
	});

	exportChild = spawn(
		"docker",
		[
			"exec",
			"--interactive",
			"--env",
			`PGPASSWORD=${password}`,
			container,
			"psql",
			"--host",
			"127.0.0.1",
			"--port",
			"5432",
			"--username",
			loginRole,
			"--dbname",
			"postgres",
			"--quiet",
			"--no-align",
			"--tuples-only",
			"--set",
			"ON_ERROR_STOP=1",
		],
		{
			cwd: repositoryRoot,
			env: createCleanProcessEnvironment(),
			stdio: ["pipe", "pipe", "pipe"],
		},
	);
	exportCompletion = new Promise((resolve, reject) => {
		exportChild.once("error", reject);
		exportChild.once("close", resolve);
	});
	let stderr = "";
	exportChild.stderr.setEncoding("utf8");
	exportChild.stderr.on("data", (chunk) => {
		stderr = `${stderr}${chunk}`.slice(-8192);
	});
	exportChild.stdin.end(buildConsistentExportSql({ manifest }));
	const lines = createInterface({
		input: exportChild.stdout,
		crlfDelay: Infinity,
	});
	const metadata = {
		migrationCutoff: manifest.migrationCutoff,
		ownerPersonaUserId: context.ownerPersonaUserId,
		ownerEmailSha256: context.ownerEmailSha256,
		sanitizationPolicySha256: createHash("sha256")
			.update(manifestSource)
			.digest("hex"),
	};
	const storageAssets = createStorageAssetInventory({
		ownerSourceUserId,
		ownerPersonaUserId: context.ownerPersonaUserId,
	});
	const parsedRecords = parseConsistentExportLines({
		lines,
		expectedDatabase: "postgres",
		expectedRole: loginRole,
		expectedViews: expectedExportViews(manifest),
		expectedOwnerUserId: ownerSourceUserId,
		expectedOwnerEmailSha256: ownerEmailSha256,
		onPreflight: (preflight) => {
			if (!Array.isArray(preflight.migrationHistory)) {
				throw new Error("The source preflight omitted migration history.");
			}
			metadata.sourceMigrationHistory = preflight.migrationHistory;
		},
	});
	const recordsWithStorageInventory = async function* () {
		for await (const record of parsedRecords) {
			const row = record.row;
			const ownerColumns =
				manifest.tables.find((table) => table.name === record.table)
					?.ownerIdentityColumns ?? [];
			const isOwner = ownerColumns.some(
				(columnName) => row[columnName] === ownerSourceUserId,
			);
			storageAssets.observe(record, { ownerRow: isOwner });
			yield record;
		}
	};
	const sanitizedRecords = sanitizeRecordStream({
		records: recordsWithStorageInventory(),
		manifest,
		context,
	});
	const baseline = await createAndActivateBaseline({
		artifactRoot,
		records: sanitizedRecords,
		metadata,
		expectedTables: includedTables,
		assets: (async function* () {
			sourceEnvironment = readLocalSupabaseEnvironment({
				cwd: repositoryRoot,
			});
			sourceAdminClient = createClient(
				sourceEnvironment.apiUrl,
				sourceEnvironment.serviceRoleKey,
				{
					auth: {
						autoRefreshToken: false,
						detectSessionInUrl: false,
						persistSession: false,
					},
				},
			);
			const { data: created, error: createError } =
				await sourceAdminClient.auth.admin.createUser({
					email: storageEmail,
					password: storagePassword,
					email_confirm: true,
					app_metadata: {
						rehearsal_owner_user_id: ownerSourceUserId,
					},
				});
			if (createError || !created.user) {
				throw new Error(
					"The local Rehearsal Storage proof identity could not be created.",
					{ cause: createError ?? undefined },
				);
			}
			storageUserId = created.user.id;
			runContainerPsql({
				user: "postgres",
				sql: `update auth.users
set role = 'rehearsal_storage_reader'
where id = ${quoteLiteral(storageUserId)}::uuid;
do $verify_storage_identity$
begin
	if not exists (
		select 1 from auth.users
		where id = ${quoteLiteral(storageUserId)}::uuid
			and role = 'rehearsal_storage_reader'
	) then
		raise exception 'The Rehearsal Storage proof role was not applied';
	end if;
end
$verify_storage_identity$;`,
			});
			const descriptors = storageAssets.values();
			if (!descriptors.length && !retainLocalBaseline) {
				storageProofPath = `rehearsal-proof/${suffix}.png`;
				const { error: uploadError } = await sourceAdminClient.storage
					.from("food-image-assets")
					.upload(
						storageProofPath,
						Buffer.from(
							"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
							"base64",
						),
						{ contentType: "image/png", upsert: false },
					);
				if (uploadError) {
					throw new Error(
						"The local Rehearsal Storage proof object could not be created.",
						{ cause: uploadError },
					);
				}
				descriptors.push({
					bucket: "food-image-assets",
					sourcePath: storageProofPath,
					objectPath: storageProofPath,
				});
			}
			yield* streamAuthorizedStorageAssets({
				apiUrl: sourceEnvironment.apiUrl,
				publishableKey: sourceEnvironment.publishableKey,
				email: storageEmail,
				password: storagePassword,
				ownerSourceUserId,
				descriptors,
			});
		})(),
		migrationFiles: async () => {
			const migrationBundle = await readMigrationSourceBundle({
				directory: applicationMigrations,
				sourceLedger: metadata.sourceMigrationHistory,
			});
			metadata.migrationHistorySha256 = createMigrationReplayReceipt({
				files: migrationBundle,
				ledger: metadata.sourceMigrationHistory,
			}).historySha256;
			return migrationBundle;
		},
	});
	const exitCode = await exportCompletion;
	if (exitCode !== 0) {
		throw new Error(
			`The installed Rehearsal export stream failed without exposing row data: ${stderr.trim()}`,
		);
	}
	await verifyActiveBaseline({ artifactRoot });
	if (!metadata.sourceMigrationHistory?.length) {
		throw new Error(
			"The installed boundary returned an empty migration history.",
		);
	}
	console.log(
		`Installed Rehearsal boundary streamed and sanitized ${baseline.rowCount} rows from ${includedTables.length} explicit tables; the ${retainLocalBaseline ? "local" : "temporary"} baseline verified successfully.`,
	);
} catch (error) {
	primaryError = error;
} finally {
	context?.dispose();
	if (exportChild?.exitCode === null) exportChild.kill("SIGTERM");
	try {
		if (storageProofPath && sourceAdminClient) {
			const { error } = await sourceAdminClient.storage
				.from("food-image-assets")
				.remove([storageProofPath]);
			if (error) cleanupError ??= error;
		}
		if (storageUserId) {
			if (sourceAdminClient) {
				const { error } =
					await sourceAdminClient.auth.admin.deleteUser(storageUserId);
				if (error) cleanupError ??= error;
			} else {
				runContainerPsql({
					user: "postgres",
					sql: `delete from auth.users where id = ${quoteLiteral(storageUserId)}::uuid;`,
				});
			}
		}
		if (!retainLocalBaseline) {
			await removeBaselineArtifactRoot({ artifactRoot });
			await rm(artifactParent, { recursive: true, force: true });
		}
		runContainerPsql({
			user: "postgres",
			sql: `delete from rehearsal_export.source_scopes where login_role = ${quoteLiteral(loginRole)};
drop role if exists ${quoteIdentifier(loginRole)};`,
		});
	} catch (error) {
		cleanupError ??= error;
	}
}

if (cleanupError) {
	const cleanupFailure = new Error(
		`Installed Rehearsal proof cleanup failed for ${loginRole}${retainLocalBaseline ? "" : ` and ${artifactParent}`}.`,
		{ cause: cleanupError },
	);
	if (primaryError) {
		throw new AggregateError(
			[primaryError, cleanupFailure],
			"The installed Rehearsal proof and its cleanup both failed.",
		);
	}
	throw cleanupFailure;
}
if (primaryError) throw primaryError;
