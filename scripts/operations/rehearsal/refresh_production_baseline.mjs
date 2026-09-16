#!/usr/bin/env node
/**
 * Purpose: Build an immutable local Rehearsal baseline from the installed hosted
 * read-only database and Storage boundaries. It never receives a source write token.
 * Run: `node scripts/operations/rehearsal/refresh_production_baseline.mjs` after provisioning the reviewed source roles.
 */

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { readRehearsalServiceEnvironment } from "@rehearsal-db/core/service-environment";
import {
	createAndActivateBaseline,
	pruneBaselineGenerations,
	verifyActiveBaseline,
} from "@rehearsal-db/core/baseline";
import {
	createSanitizationContext,
	sanitizeRow,
} from "../../lib/rehearsal/sanitizer.mjs";
import {
	buildConsistentExportSql,
	expectedExportViews,
	parseConsistentExportLines,
} from "../../lib/rehearsal/source_stream.mjs";
import {
	createStorageAssetInventory,
	streamAuthorizedStorageAssets,
} from "../../lib/rehearsal/source_assets.mjs";
import {
	createMigrationReplayReceipt,
	readMigrationSourceBundle,
} from "@rehearsal-db/core/migrations";
import { parseRehearsalSourceDatabaseUrl } from "../../lib/rehearsal/source_connection.mjs";
import { createRehearsalSourcePsqlInvocation } from "../../lib/rehearsal/postgres_client.mjs";
import { loadOrCreateSanitizationKey } from "../../lib/rehearsal/sanitization_key.mjs";
import { captureLinkedProductionSchema } from "../../lib/rehearsal/source_schema.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sourceEnvironmentPath = join(
	repositoryRoot,
	".env.rehearsal-source.local",
);
const sourceKeys = [
	"REHEARSAL_SOURCE_DATABASE_URL",
	"REHEARSAL_SOURCE_STORAGE_URL",
	"REHEARSAL_SOURCE_STORAGE_PUBLISHABLE_KEY",
	"REHEARSAL_SOURCE_STORAGE_ACCESS_TOKEN",
	"REHEARSAL_SOURCE_STORAGE_REFRESH_TOKEN",
];
const manifestPath = join(
	repositoryRoot,
	"infrastructure/rehearsal/application/sanitization-policy.json",
);
const migrationsDirectory = new URL(
	"../../../supabase/migrations/",
	import.meta.url,
);
const artifactRoot = join(repositoryRoot, ".rehearsal");
const sanitizationKey = await loadOrCreateSanitizationKey({ artifactRoot });

const credentials = await readRehearsalServiceEnvironment({
	path: sourceEnvironmentPath,
	keys: sourceKeys,
});
const sourceDatabase = parseRehearsalSourceDatabaseUrl(
	credentials.REHEARSAL_SOURCE_DATABASE_URL,
);
const expectedDatabase = sourceDatabase.database;
const expectedRole = sourceDatabase.databaseRole;
const linkedProjectReference = (
	await readFile(join(repositoryRoot, "supabase/.temp/project-ref"), "utf8")
).trim();
const schemaSql = await captureLinkedProductionSchema({
	repositoryRoot,
	artifactRoot,
	expectedProjectReference: sourceDatabase.poolerProjectReference,
	linkedProjectReference,
});

const manifestSource = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
const includedTables = manifest.tables
	.filter((table) => table.sourceRows !== "EXCLUDE")
	.map((table) => table.name);
const metadata = {
	migrationCutoff: manifest.migrationCutoff,
	sanitizationPolicySha256: createHash("sha256")
		.update(manifestSource)
		.digest("hex"),
};
let context;
let ownerSourceUserId;
let storageInventory;

const postgresClient = createRehearsalSourcePsqlInvocation(sourceDatabase);
const exportChild = spawn(
	postgresClient.command,
	[
		...postgresClient.args,
		"--quiet",
		"--no-align",
		"--tuples-only",
		"--set",
		"ON_ERROR_STOP=1",
	],
	{
		cwd: repositoryRoot,
		env: postgresClient.environment,
		stdio: ["pipe", "pipe", "pipe"],
	},
);
let stderr = "";
exportChild.stderr.setEncoding("utf8");
exportChild.stderr.on("data", (chunk) => {
	stderr = `${stderr}${chunk}`.slice(-8192);
});
const completion = new Promise((resolve, reject) => {
	exportChild.once("error", reject);
	exportChild.once("close", resolve);
});
exportChild.stdin.end(buildConsistentExportSql({ manifest }));

try {
	const parsedRecords = parseConsistentExportLines({
		lines: createInterface({ input: exportChild.stdout, crlfDelay: Infinity }),
		expectedDatabase,
		expectedRole,
		expectedViews: expectedExportViews(manifest),
		requireEphemeralCredential: true,
		onPreflight: (preflight) => {
			if (
				!/^[0-9a-f-]{36}$/u.test(preflight.ownerUserId ?? "") ||
				!/^[a-f0-9]{64}$/u.test(preflight.ownerEmailSha256 ?? "") ||
				!Array.isArray(preflight.migrationHistory)
			) {
				throw new Error(
					"The source omitted its fixed owner or migration receipt.",
				);
			}
			ownerSourceUserId = preflight.ownerUserId;
			context = createSanitizationContext({
				key: sanitizationKey,
				ownerSourceUserId,
				ownerEmailSha256: preflight.ownerEmailSha256,
			});
			storageInventory = createStorageAssetInventory({
				ownerSourceUserId,
				ownerPersonaUserId: context.ownerPersonaUserId,
			});
			metadata.ownerPersonaUserId = context.ownerPersonaUserId;
			metadata.ownerEmailSha256 = context.ownerEmailSha256;
			metadata.sourceMigrationHistory = preflight.migrationHistory;
		},
	});
	const observedRecords = async function* () {
		for await (const record of parsedRecords) {
			const tablePolicy = manifest.tables.find(
				(table) => table.name === record.table,
			);
			if (!tablePolicy || !context || !storageInventory) {
				throw new Error(
					"The source row arrived before its verified preflight.",
				);
			}
			const ownerColumns = tablePolicy.ownerIdentityColumns ?? [];
			storageInventory.observe(record, {
				ownerRow: ownerColumns.some(
					(columnName) => record.row[columnName] === ownerSourceUserId,
				),
			});
			yield {
				table: record.table,
				row: sanitizeRow({ tablePolicy, row: record.row, context }),
			};
		}
	};
	const baseline = await createAndActivateBaseline({
		artifactRoot,
		records: observedRecords(),
		metadata,
		expectedTables: includedTables,
		assets: (async function* () {
			if (!storageInventory) {
				throw new Error("The source Storage inventory was not initialized.");
			}
			yield* streamAuthorizedStorageAssets({
				apiUrl: credentials.REHEARSAL_SOURCE_STORAGE_URL,
				publishableKey: credentials.REHEARSAL_SOURCE_STORAGE_PUBLISHABLE_KEY,
				accessToken: credentials.REHEARSAL_SOURCE_STORAGE_ACCESS_TOKEN,
				refreshToken: credentials.REHEARSAL_SOURCE_STORAGE_REFRESH_TOKEN,
				ownerSourceUserId,
				descriptors: storageInventory.values(),
			});
		})(),
		migrationFiles: async () => {
			const migrationBundle = await readMigrationSourceBundle({
				directory: migrationsDirectory,
				sourceLedger: metadata.sourceMigrationHistory,
			});
			metadata.migrationHistorySha256 = createMigrationReplayReceipt({
				files: migrationBundle,
				ledger: metadata.sourceMigrationHistory,
			}).historySha256;
			return migrationBundle;
		},
		schemaSql,
	});
	const exitCode = await completion;
	if (exitCode !== 0) {
		throw new Error(
			`The hosted Rehearsal export failed without exposing row data: ${stderr.trim()}`,
		);
	}
	await verifyActiveBaseline({ artifactRoot });
	const pruning = await pruneBaselineGenerations({ artifactRoot, retain: 2 });
	console.log(
		`Activated Rehearsal baseline ${baseline.generationId}: ${baseline.rowCount} rows, ${Object.keys(baseline.storageAssets ?? {}).length} real Storage objects; pruned ${pruning.removed.length} obsolete generation(s).`,
	);
} finally {
	context?.dispose();
	sanitizationKey.fill(0);
	if (exportChild.exitCode === null) exportChild.kill("SIGTERM");
	await completion.catch(() => undefined);
}
