/**
 * Purpose: Verify that BlendCalc's freshly replayed local application database has an
 * exact package-generated migration receipt and no blendCalcAPI version collision.
 * Run: `npm run db:rehearsal:verify-local-history` after a local database reset.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createCleanProcessEnvironment } from "../../lib/environment/runtime_environment.mjs";
import {
	assertNoCrossDatabaseMigrationVersions,
	buildMigrationLedgerInventory,
	compareSourceToReplay,
	createMigrationReplayReceipt,
	readMigrationFileInventory,
} from "@rehearsal-db/core/migrations";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const applicationMigrations = new URL(
	"../../../supabase/migrations/",
	import.meta.url,
);
const apiMigrations = new URL(
	"../../../infrastructure/blendCalcAPI/supabase/migrations/",
	import.meta.url,
);
const container = "supabase_db_blendcalc";

const result = spawnSync(
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
		maxBuffer: 64 * 1024 * 1024,
		input: `
select coalesce(json_agg(json_build_object(
	'version', version,
	'name', name,
	'statements', statements
) order by version), '[]'::json)::text
from supabase_migrations.schema_migrations;
`,
	},
);
if (result.status !== 0 || result.error) {
	throw new Error(
		`Could not read the isolated local migration ledger: ${result.error?.message ?? result.stderr.trim()}`,
	);
}
if (!result.stdout.trim()) {
	throw new Error("The isolated local migration ledger returned no content.");
}

const [applicationFiles, apiFiles] = await Promise.all([
	readMigrationFileInventory(applicationMigrations),
	readMigrationFileInventory(apiMigrations),
]);
assertNoCrossDatabaseMigrationVersions({ applicationFiles, apiFiles });
const ledger = buildMigrationLedgerInventory(
	JSON.parse(result.stdout.trim()),
	"Local application migration ledger",
);
const receipt = createMigrationReplayReceipt({
	files: applicationFiles,
	ledger,
});
const comparison = compareSourceToReplay({
	sourceLedger: ledger,
	replayReceipt: receipt,
});
if (comparison.candidates.length !== 0) {
	throw new Error(
		"A local replay cannot contain unapplied migration candidates.",
	);
}

console.log(
	`Verified ${receipt.entries.length} content-addressed application migrations through ${comparison.cutoff} (${receipt.historySha256}).`,
);
