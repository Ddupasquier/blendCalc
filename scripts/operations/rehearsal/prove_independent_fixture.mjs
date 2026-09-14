/**
 * Purpose: Prove the public Rehearsal CLI against a synthetic non-BlendCalc Supabase
 * project, including one valid and one deliberately invalid candidate migration.
 * Run: `npm run rehearsal:fixture:prove`. Uses only disposable local Docker state.
 */

import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCleanProcessEnvironment } from "../../lib/rehearsal/process_environment.mjs";
import {
	readLocalSupabaseEnvironment,
	runLocalCommand,
} from "../../lib/environment/local_supabase.mjs";
import {
	createAndActivateBaseline,
	removeBaselineArtifactRoot,
} from "../../lib/rehearsal/baseline_artifact.mjs";
import {
	buildMigrationLedgerInventory,
	createMigrationReplayReceipt,
	readMigrationFileInventory,
} from "../../lib/rehearsal/migration_history.mjs";
import { assembleProspectiveRehearsalPackage } from "../../lib/rehearsal/prospective_package.mjs";
import {
	buildRehearsalPlan,
	inspectRehearsalMigrations,
} from "../../lib/rehearsal/plan.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const fixtureSource = join(repositoryRoot, "tests/fixtures/rehearsal-project");
const projectId = "rehearsal-fixture";

const findContainer = ({ cwd }) => {
	const output = runLocalCommand(
		"docker",
		[
			"ps",
			"--filter",
			`label=com.supabase.cli.project=${projectId}`,
			"--format",
			"{{.Names}}",
		],
		{ capture: true, cwd },
	);
	const names = output
		.split("\n")
		.map((value) => value.trim())
		.filter((value) => value.startsWith("supabase_db_"));
	if (names.length !== 1) {
		throw new Error(
			`Expected one fixture database container; found ${names.length}.`,
		);
	}
	return names[0];
};

const runPsql = ({ cwd, sql }) =>
	runLocalCommand(
		"docker",
		[
			"exec",
			"--interactive",
			findContainer({ cwd }),
			"psql",
			"--quiet",
			"--no-align",
			"--tuples-only",
			"--set",
			"ON_ERROR_STOP=1",
			"--username",
			"postgres",
			"--dbname",
			"postgres",
		],
		{ capture: true, cwd, input: sql },
	);

const prepareBaseline = async ({ cwd, historicalFilename }) => {
	const inventory = await readMigrationFileInventory(
		new URL("./", pathToFileURL(`${join(cwd, "supabase/migrations")}/`)),
	);
	const historical = inventory.find(
		(entry) => entry.filename === historicalFilename,
	);
	const content = await readFile(
		join(cwd, "supabase/migrations", historicalFilename),
		"utf8",
	);
	const record = JSON.parse(
		(
			await readFile(join(cwd, "rehearsal/sanitized-data.ndjson"), "utf8")
		).trim(),
	);
	const sourceMigrationHistory = buildMigrationLedgerInventory([
		{
			version: historical.version,
			name: historical.name,
			statements: content
				.trim()
				.split(/;\s*(?:\n|$)/u)
				.map((statement) => statement.trim())
				.filter(Boolean),
		},
	]);
	const migrationHistorySha256 = createMigrationReplayReceipt({
		files: [historical],
		ledger: sourceMigrationHistory,
	}).historySha256;
	return createAndActivateBaseline({
		artifactRoot: join(cwd, ".rehearsal"),
		generationId: "20260101T000000Z-bbbbbbbbbbbb",
		records: [record],
		metadata: {
			migrationCutoff: "20260101000000",
			migrationHistorySha256,
			sanitizationPolicySha256: "b".repeat(64),
			sourceMigrationHistory,
		},
		expectedTables: ["widgets"],
		migrationFiles: [{ ...historical, content }],
		assets: [
			{
				bucket: "fixture-assets",
				objectPath: "proof/exact-byte.txt",
				contentType: "text/plain",
				content: Buffer.from("independent Rehearsal Storage proof\n", "utf8"),
			},
		],
	});
};

const executeCli = ({ cwd, args }) =>
	spawnSync(join(cwd, "node_modules/.bin/rehearsal"), args, {
		cwd,
		encoding: "utf8",
		env: createCleanProcessEnvironment(),
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 16 * 1024 * 1024,
	});

const runtimeExists = (runtimeWorkdir) =>
	stat(runtimeWorkdir)
		.then(() => true)
		.catch((error) => {
			if (error?.code === "ENOENT") return false;
			throw error;
		});

const main = async () => {
	const temporaryRoot = await mkdtemp(
		join(tmpdir(), "rehearsal-fixture-proof-"),
	);
	const cwd = join(temporaryRoot, "project");
	const packageRoot = join(temporaryRoot, "package");
	const packageOutput = join(temporaryRoot, "packed");
	const runtimeWorkdir = join(cwd, ".rehearsal/runtime");
	const historicalFilename = "20260101000000_create_widgets.sql";
	const validFilename = "20260101000100_add_widget_description.sql";
	const invalidFilename = "20260101000200_invalid_candidate.sql";
	const timings = {};
	try {
		await cp(fixtureSource, cwd, { recursive: true });
		await assembleProspectiveRehearsalPackage({
			repositoryRoot,
			destination: packageRoot,
		});
		await mkdir(packageOutput, { recursive: true });
		const packResult = JSON.parse(
			runLocalCommand(
				"npm",
				[
					"pack",
					"--json",
					"--ignore-scripts",
					"--pack-destination",
					packageOutput,
				],
				{ capture: true, cwd: packageRoot },
			),
		)[0];
		const tarball = join(packageOutput, packResult.filename);
		runLocalCommand(
			"npm",
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--no-save",
				tarball,
			],
			{ capture: true, cwd },
		);
		let startedAt = performance.now();
		await prepareBaseline({ cwd, historicalFilename });
		const validPlan = await buildRehearsalPlan({ projectRoot: cwd });
		timings.baselineAndPlanMs = Math.round(performance.now() - startedAt);

		startedAt = performance.now();
		const validRun = executeCli({
			cwd,
			args: [
				"run",
				`--confirm-candidates=${validPlan.migrations.candidateSha256}`,
				"--json",
				"--debug",
			],
		});
		if (validRun.status !== 0) {
			throw new Error(
				`The valid fixture CLI run failed: ${validRun.stdout || validRun.stderr}`,
			);
		}
		const validProof = runPsql({
			cwd,
			sql: `select count(*) = 1
and exists (
	select 1 from information_schema.columns
	where table_schema = 'public'
		and table_name = 'widgets'
		and column_name = 'description'
)
from public.widgets;`,
		}).trim();
		if (validProof !== "t") {
			throw new Error(
				`The valid fixture migration did not preserve data and add its column; proof returned ${JSON.stringify(validProof)}.`,
			);
		}
		const fixtureEnvironment = readLocalSupabaseEnvironment({
			cwd,
			workdir: runtimeWorkdir,
		});
		const assetResponse = await fetch(
			`${fixtureEnvironment.apiUrl}/storage/v1/object/fixture-assets/proof/exact-byte.txt`,
			{
				headers: {
					apikey: fixtureEnvironment.serviceRoleKey,
					authorization: `Bearer ${fixtureEnvironment.serviceRoleKey}`,
				},
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (
			!assetResponse.ok ||
			(await assetResponse.text()) !== "independent Rehearsal Storage proof\n"
		) {
			throw new Error(
				"The installed package did not restore the fixture Storage byte exactly.",
			);
		}
		const appliedInspection = await inspectRehearsalMigrations({
			projectRoot: cwd,
		});
		if (
			appliedInspection.migrations.at(-1)?.status !==
			"applied_to_current_runtime"
		) {
			throw new Error(
				"Migration inspection did not recognize the verified runtime receipt.",
			);
		}
		timings.validCliRunAndProofMs = Math.round(performance.now() - startedAt);

		await cp(
			join(cwd, "broken", invalidFilename),
			join(cwd, "supabase/migrations", invalidFilename),
		);
		const invalidPlan = await buildRehearsalPlan({ projectRoot: cwd });
		startedAt = performance.now();
		const invalidRun = executeCli({
			cwd,
			args: [
				"run",
				`--confirm-candidates=${invalidPlan.migrations.candidateSha256}`,
				"--json",
			],
		});
		if (invalidRun.status === 0) {
			throw new Error(
				"The deliberately invalid fixture migration unexpectedly passed.",
			);
		}
		const invalidFailure = JSON.parse(invalidRun.stdout);
		if (invalidFailure.error?.category !== "migration_candidate_failure") {
			throw new Error(
				`The invalid fixture failed with the wrong category: ${invalidRun.stdout || invalidRun.stderr}`,
			);
		}
		if (await runtimeExists(runtimeWorkdir)) {
			throw new Error("The failed fixture runtime was not discarded.");
		}
		timings.invalidCandidateRefusalMs = Math.round(
			performance.now() - startedAt,
		);

		console.log(
			JSON.stringify(
				{
					status: "passed",
					fixture: "rehearsal-project",
					installedPackage: `${packResult.name}@${packResult.version}`,
					validCandidate: validFilename,
					invalidCandidate: invalidFilename,
					timings,
				},
				null,
				2,
			),
		);
	} finally {
		executeCli({ cwd, args: ["discard"] });
		await removeBaselineArtifactRoot({
			artifactRoot: join(cwd, ".rehearsal"),
		}).catch(() => undefined);
		await rm(temporaryRoot, { recursive: true, force: true });
	}
};

await main();
