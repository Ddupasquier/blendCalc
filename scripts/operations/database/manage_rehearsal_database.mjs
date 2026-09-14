/**
 * Purpose: Restore and manage the disposable local Rehearsal Supabase runtime from
 * the active verified sanitized baseline.
 * Run: `npm run db:rehearsal:reset`, `npm run db:rehearsal:start`,
 * `npm run db:rehearsal:status`, or `npm run db:rehearsal:stop`.
 * Reset deletes only the dedicated local Rehearsal runtime and its Docker volumes.
 */

import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { once } from "node:events";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import {
	resolveActiveBaselinePaths,
	verifyActiveBaseline,
} from "../../lib/rehearsal/baseline_artifact.mjs";
import {
	createCleanProcessEnvironment,
	assertLoopbackUrl,
} from "../../lib/rehearsal/process_environment.mjs";
import {
	localCommandSucceeds,
	readLocalSupabaseEnvironment,
	removeLocalSupabaseProjectResources,
	runLocalCommand,
	startLocalSupabase,
	stopLocalSupabase,
} from "../../lib/environment/local_supabase.mjs";
import {
	buildRestoreSqlPrefix,
	buildRestoreSqlSuffix,
	createCandidateMigrationReceipt,
	encodeBaselineRecordForCopy,
	summarizeRestoreError,
} from "../../lib/rehearsal/runtime_restore.mjs";
import {
	buildMigrationLedgerInventory,
	compareSourceToReplay,
	createMigrationReplayReceipt,
	readMigrationFileInventory,
} from "../../lib/rehearsal/migration_history.mjs";
import { loadRehearsalConfig } from "../../lib/rehearsal/configuration.mjs";
import { readRehearsalServiceEnvironment } from "../../lib/rehearsal/service_environment.mjs";
import {
	captureLocalPublicSchema,
	compareProductionSchemaDumps,
} from "../../lib/rehearsal/schema_snapshot.mjs";

const repositoryRoot = process.cwd();
const loadedConfiguration = await loadRehearsalConfig({
	projectRoot: repositoryRoot,
});
const { config, paths: configuredPaths } = loadedConfiguration;
const artifactRoot = configuredPaths.artifactDirectory;
const runtimeWorkdir = configuredPaths.runtimeWorkdir;
const runtimeSupabaseDirectory = join(runtimeWorkdir, "supabase");
const runtimeMarkerPath = join(runtimeWorkdir, "baseline.json");
const runtimeCandidateReceiptPath = join(
	runtimeWorkdir,
	"candidate-receipt.json",
);
const environmentPath = configuredPaths.applicationEnvironment;
const configTemplatePath = configuredPaths.rehearsalConfig;
const manifestPath = configuredPaths.sanitizationPolicy;
const applicationMigrations = new URL(
	"./",
	pathToFileURL(`${configuredPaths.migrationDirectory}/`),
);
const projectId = config.runtime.projectId;
const runtimeAdapter = configuredPaths.runtimeAdapter
	? await import(pathToFileURL(configuredPaths.runtimeAdapter).href)
	: null;
const environmentKeyPattern = /^[A-Z][A-Z0-9_]*$/u;
const action = process.argv[2] ?? "status";

const readServiceEnvironment = () =>
	readRehearsalServiceEnvironment({
		path: configuredPaths.serviceEnvironment,
		keys: config.supabase.serviceEnvironmentVariables,
		blockedKeys: config.safety.blockedEnvironmentVariables,
	});

const assertRuntimePath = () => {
	const resolvedRoot = resolve(artifactRoot);
	const resolvedRuntime = resolve(runtimeWorkdir);
	if (resolvedRuntime !== join(resolvedRoot, "runtime")) {
		throw new Error("Refusing an unsafe Rehearsal runtime path.");
	}
};

const pathExists = async (path) =>
	stat(path)
		.then(() => true)
		.catch((error) => {
			if (error?.code === "ENOENT") return false;
			throw error;
		});

const hasProjectRuntimeResources = () => {
	const containers = runLocalCommand(
		"docker",
		[
			"ps",
			"--all",
			"--filter",
			`label=com.supabase.cli.project=${projectId}`,
			"--format",
			"{{.ID}}",
		],
		{ capture: true, cwd: repositoryRoot },
	).trim();
	const volumes = runLocalCommand(
		"docker",
		["volume", "ls", "--format", "{{.Name}}"],
		{ capture: true, cwd: repositoryRoot },
	)
		.split("\n")
		.some((name) => name.trim().endsWith(`_${projectId}`));
	return Boolean(containers) || volumes;
};

const removeRuntime = async () => {
	assertRuntimePath();
	const hasRuntimeConfig = await pathExists(
		join(runtimeSupabaseDirectory, "config.toml"),
	);
	if (hasRuntimeConfig || hasProjectRuntimeResources()) {
		try {
			const serviceEnvironment = await readServiceEnvironment().catch(
				() => ({}),
			);
			runLocalCommand(
				"supabase",
				hasRuntimeConfig
					? ["stop", "--no-backup", "--workdir", runtimeWorkdir]
					: ["stop", "--no-backup", "--project-id", projectId],
				{ cwd: repositoryRoot, environment: serviceEnvironment },
			);
		} catch {
			removeLocalSupabaseProjectResources({
				cwd: repositoryRoot,
				projectId,
			});
		}
	}
	await rm(runtimeWorkdir, { recursive: true, force: true });
	await rm(environmentPath, { force: true });
};

const findDatabaseContainer = () => {
	const output = runLocalCommand(
		"docker",
		[
			"ps",
			"--filter",
			`label=com.supabase.cli.project=${projectId}`,
			"--format",
			"{{.Names}}",
		],
		{ capture: true, cwd: repositoryRoot },
	);
	const names = output
		.split("\n")
		.map((value) => value.trim())
		.filter((value) => value.startsWith("supabase_db_"));
	if (names.length !== 1) {
		throw new Error(
			`Expected one local Rehearsal database container; found ${names.length}.`,
		);
	}
	return names[0];
};

const writeChunk = async (stream, chunk, completion) => {
	if (stream.destroyed || stream.writableEnded) {
		throw new Error("The Rehearsal restore connection closed early.");
	}
	if (!stream.write(chunk)) {
		await Promise.race([once(stream, "drain"), completion]);
		if (stream.destroyed || stream.writableEnded) {
			throw new Error("The Rehearsal restore connection closed early.");
		}
	}
};

const restoreBaselineRows = async ({ baseline, paths, manifest }) => {
	const child = spawn(
		"docker",
		[
			"exec",
			"--interactive",
			findDatabaseContainer(),
			"psql",
			"--quiet",
			"--set",
			"ON_ERROR_STOP=1",
			"--username",
			"postgres",
			"--dbname",
			"postgres",
		],
		{
			cwd: repositoryRoot,
			env: createCleanProcessEnvironment(),
			stdio: ["pipe", "ignore", "pipe"],
		},
	);
	let stderr = "";
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr = `${stderr}${chunk}`.slice(-16_384);
	});
	const completion = new Promise((complete, reject) => {
		child.once("error", reject);
		child.once("close", complete);
	});
	child.stdin.on("error", () => undefined);
	try {
		await writeChunk(child.stdin, buildRestoreSqlPrefix(), completion);
		const lines = createInterface({
			input: createReadStream(paths.dataPath, { encoding: "utf8" }),
			crlfDelay: Infinity,
		});
		for await (const line of lines) {
			if (line) {
				await writeChunk(
					child.stdin,
					`${encodeBaselineRecordForCopy(line)}\n`,
					completion,
				);
			}
		}
		await writeChunk(
			child.stdin,
			buildRestoreSqlSuffix({
				manifest,
				tableCounts: baseline.tableCounts,
			}),
			completion,
		);
		child.stdin.end();
		const exitCode = await completion;
		if (exitCode !== 0) {
			throw new Error(
				`The local Rehearsal restore failed. ${summarizeRestoreError(stderr)}`,
			);
		}
	} catch (error) {
		if (child.exitCode === null) child.kill("SIGTERM");
		await completion.catch(() => undefined);
		throw new Error(
			`The local Rehearsal restore failed. ${summarizeRestoreError(stderr)}`,
			{ cause: error },
		);
	}
};

const restoreBaselineAssets = async ({ baseline, paths, environment }) => {
	const assets = Object.entries(baseline.storageAssets ?? {});
	if (assets.length === 0) return;
	assertLoopbackUrl("Rehearsal Supabase API", environment.apiUrl);
	for (const [relativePath, receipt] of assets) {
		const content = await readFile(
			join(paths.generationDirectory, relativePath),
		);
		const objectUrl = new URL(
			`/storage/v1/object/${encodeURIComponent(receipt.bucket)}/${receipt.objectPath
				.split("/")
				.map(encodeURIComponent)
				.join("/")}`,
			environment.apiUrl,
		);
		const response = await fetch(objectUrl, {
			method: "POST",
			headers: {
				apikey: environment.serviceRoleKey,
				authorization: `Bearer ${environment.serviceRoleKey}`,
				"content-type": receipt.contentType,
				"x-upsert": "true",
			},
			body: content,
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok) {
			throw new Error(
				`The local Rehearsal Storage restore failed for ${receipt.bucket} with status ${response.status}.`,
			);
		}
	}
};

const prepareRuntimeWorkdir = async ({ baseline, paths }) => {
	assertRuntimePath();
	await mkdir(join(runtimeSupabaseDirectory, "migrations"), {
		recursive: true,
		mode: 0o700,
	});
	await cp(configTemplatePath, join(runtimeSupabaseDirectory, "config.toml"));
	for (const filename of Object.keys(baseline.migrations).sort()) {
		await cp(
			join(paths.migrationsDirectory, filename),
			join(runtimeSupabaseDirectory, "migrations", filename),
		);
	}
	await writeFile(
		runtimeMarkerPath,
		`${JSON.stringify(
			{
				formatVersion: 1,
				generationId: baseline.generationId,
				dataSha256: baseline.files["sanitized-data.ndjson"].sha256,
			},
			null,
			"\t",
		)}\n`,
		{ mode: 0o600 },
	);
};

const writeRuntimeEnvironment = async ({
	environment,
	baseline,
	projectRuntime,
}) => {
	assertLoopbackUrl("Rehearsal Supabase API", environment.apiUrl);
	const variables = {
		REHEARSAL_RUNTIME_ENVIRONMENT: "rehearsal",
		REHEARSAL_BASELINE_ID: baseline.generationId,
		SUPABASE_URL: environment.apiUrl,
		SUPABASE_PUBLISHABLE_KEY: environment.publishableKey,
		SUPABASE_SERVICE_ROLE_KEY: environment.serviceRoleKey,
		...projectRuntime.environmentVariables,
	};
	await writeFile(
		environmentPath,
		[
			"# Generated local Rehearsal runtime credentials. Do not commit.",
			...Object.entries(variables).map(([key, value]) => `${key}=${value}`),
			"",
		].join("\n"),
		{ mode: 0o600 },
	);
};

const runDatabaseSql = (sql) => {
	const databaseArguments = [
		"exec",
		"--interactive",
		findDatabaseContainer(),
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
	];
	return runLocalCommand("docker", databaseArguments, {
		capture: true,
		cwd: repositoryRoot,
		input: sql,
	});
};

const restoreProductionSchema = async ({ baseline, paths }) => {
	const receipt = baseline.files?.["production-schema.sql"];
	if (baseline.formatVersion === 1 && receipt === undefined) return null;
	if (
		baseline.formatVersion !== 2 ||
		!/^[a-f0-9]{64}$/u.test(receipt?.sha256 ?? "") ||
		!Number.isSafeInteger(receipt?.bytes)
	) {
		throw new Error(
			"The active baseline predates exact production-schema restoration; refresh it first.",
		);
	}
	const schemaSql = await readFile(paths.schemaPath, "utf8");
	runDatabaseSql("drop schema if exists public cascade;");
	if (runtimeAdapter?.prepareSchema) {
		const preparation = runtimeAdapter.prepareSchema({
			runSql: runDatabaseSql,
		});
		if (!preparation || typeof preparation.message !== "string") {
			throw new Error(
				"The project runtime adapter returned an invalid schema preparation result.",
			);
		}
	}
	runDatabaseSql(schemaSql);
	const restoredSchema = await captureLocalPublicSchema({
		repositoryRoot,
		artifactRoot,
		workdir: runtimeWorkdir,
	});
	return compareProductionSchemaDumps({
		expected: schemaSql,
		actual: restoredSchema,
	});
};

const configureProjectRuntime = ({ environment, baseline }) => {
	assertLoopbackUrl("Rehearsal Supabase API", environment.apiUrl);
	if (!runtimeAdapter?.configureRuntime) {
		return {
			message: "Project-neutral local runtime is configured.",
			environmentVariables: {},
		};
	}
	const projectRuntime = runtimeAdapter.configureRuntime({
		baseline,
		environment,
		runSql: runDatabaseSql,
	});
	if (
		!projectRuntime ||
		typeof projectRuntime.message !== "string" ||
		!projectRuntime.environmentVariables ||
		typeof projectRuntime.environmentVariables !== "object" ||
		Array.isArray(projectRuntime.environmentVariables)
	) {
		throw new Error("The project runtime adapter returned an invalid result.");
	}
	for (const [key, value] of Object.entries(
		projectRuntime.environmentVariables,
	)) {
		if (
			!environmentKeyPattern.test(key) ||
			typeof value !== "string" ||
			/[\n\r\0]/u.test(value)
		) {
			throw new Error(
				"The project runtime adapter returned an unsafe environment variable.",
			);
		}
	}
	return projectRuntime;
};

const readActive = async () => {
	const [baseline, paths, manifest] = await Promise.all([
		verifyActiveBaseline({ artifactRoot }),
		resolveActiveBaselinePaths({ artifactRoot }),
		readFile(manifestPath, "utf8").then(JSON.parse),
	]);
	return { baseline, paths, manifest };
};

const resetRuntime = async () => {
	const active = await readActive();
	const serviceEnvironment = await readServiceEnvironment();
	await removeRuntime();
	try {
		await prepareRuntimeWorkdir(active);
		const environment = startLocalSupabase({
			cwd: repositoryRoot,
			workdir: runtimeWorkdir,
			exclude: ["edge-runtime", "logflare", "vector", "realtime"],
			environment: serviceEnvironment,
		});
		const structuralSchemaSha256 = await restoreProductionSchema(active);
		await restoreBaselineRows(active);
		await restoreBaselineAssets({
			baseline: active.baseline,
			paths: active.paths,
			environment,
		});
		const projectRuntime = configureProjectRuntime({
			environment,
			baseline: active.baseline,
		});
		await writeRuntimeEnvironment({
			environment,
			baseline: active.baseline,
			projectRuntime,
		});
		await writeFile(
			runtimeMarkerPath,
			`${JSON.stringify(
				{
					formatVersion: active.baseline.formatVersion,
					generationId: active.baseline.generationId,
					dataSha256: active.baseline.files["sanitized-data.ndjson"].sha256,
					schemaSha256:
						active.baseline.files?.["production-schema.sql"]?.sha256 ?? null,
					structuralSchemaSha256,
				},
				null,
				"\t",
			)}\n`,
			{ mode: 0o600 },
		);
		console.log(
			`Restored Rehearsal baseline ${active.baseline.generationId}: ${active.baseline.rowCount} rows across ${Object.keys(active.baseline.tableCounts).length} tables.`,
		);
		console.log(projectRuntime.message);
		return environment;
	} catch (error) {
		await removeRuntime().catch(() => undefined);
		throw error;
	}
};

const startRuntime = async () => {
	const { baseline } = await readActive();
	if (!(await pathExists(runtimeMarkerPath))) return resetRuntime();
	const serviceEnvironment = await readServiceEnvironment();
	const marker = JSON.parse(await readFile(runtimeMarkerPath, "utf8"));
	if (
		marker.generationId !== baseline.generationId ||
		marker.dataSha256 !== baseline.files["sanitized-data.ndjson"].sha256 ||
		marker.schemaSha256 !==
			(baseline.files?.["production-schema.sql"]?.sha256 ?? null)
	) {
		throw new Error(
			"The local Rehearsal runtime does not match the active baseline; run db:rehearsal:reset.",
		);
	}
	const environment = startLocalSupabase({
		cwd: repositoryRoot,
		workdir: runtimeWorkdir,
		exclude: ["edge-runtime", "logflare", "vector", "realtime"],
		environment: serviceEnvironment,
	});
	const projectRuntime = configureProjectRuntime({ environment, baseline });
	await writeRuntimeEnvironment({
		environment,
		baseline,
		projectRuntime,
	});
	return environment;
};

const readCandidateReceipt = async (baseline) => {
	const currentFiles = await readMigrationFileInventory(applicationMigrations);
	return {
		currentFiles,
		...createCandidateMigrationReceipt({
			baselineManifest: baseline,
			currentFiles,
		}),
	};
};

const readRuntimeMigrationLedger = () => {
	const output = runLocalCommand(
		"docker",
		[
			"exec",
			"--interactive",
			findDatabaseContainer(),
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
		{
			capture: true,
			cwd: repositoryRoot,
			input: `select coalesce(json_agg(json_build_object(
	'version', version,
	'name', name,
	'statements', statements
) order by version), '[]'::json)::text
from supabase_migrations.schema_migrations;`,
		},
	);
	return buildMigrationLedgerInventory(
		JSON.parse(output.trim()),
		"Rehearsal runtime migration ledger",
	);
};

const verifyRuntimeMigrationHistory = async ({ baseline, currentFiles }) => {
	const ledger = readRuntimeMigrationLedger();
	const appliedFiles = currentFiles.slice(0, ledger.length);
	const replayReceipt = createMigrationReplayReceipt({
		files: appliedFiles,
		ledger,
	});
	return compareSourceToReplay({
		sourceLedger: baseline.sourceMigrationHistory,
		replayReceipt,
		snapshotSchemaSha256: baseline.files?.["production-schema.sql"]?.sha256,
	});
};

const verifyRuntime = async () => {
	const { baseline } = await readActive();
	const environment = await startRuntime();
	const candidateReceipt = await readCandidateReceipt(baseline);
	const migrationComparison = await verifyRuntimeMigrationHistory({
		baseline,
		currentFiles: candidateReceipt.currentFiles,
	});
	let projectVerification;
	if (runtimeAdapter?.verifyRuntime) {
		projectVerification = runtimeAdapter.verifyRuntime({
			baseline,
			environment,
			runSql: runDatabaseSql,
		});
		if (
			!projectVerification ||
			typeof projectVerification.message !== "string"
		) {
			throw new Error(
				"The project runtime adapter returned an invalid verification result.",
			);
		}
	}
	console.log(
		`Verified Rehearsal runtime ${baseline.generationId}: immutable baseline and migration history are valid with ${migrationComparison.candidates.length} applied candidate migrations. Runtime rows may differ from the baseline until the next reset.`,
	);
	if (projectVerification) console.log(projectVerification.message);
	return { baseline, candidateReceipt, migrationComparison };
};

const migrateRuntime = async () => {
	const { baseline } = await readActive();
	await startRuntime();
	const receipt = await readCandidateReceipt(baseline);
	if (receipt.candidates.length === 0) {
		await writeFile(
			runtimeCandidateReceiptPath,
			`${JSON.stringify(
				{
					formatVersion: 1,
					baselineGenerationId: baseline.generationId,
					candidateSha256: receipt.candidateSha256,
					candidates: [],
				},
				null,
				"\t",
			)}\n`,
			{ mode: 0o600 },
		);
		console.log(
			`No candidate migrations follow baseline ${baseline.migrationCutoff}.`,
		);
		return receipt;
	}
	console.log(
		`Candidate migrations (${receipt.candidateSha256}): ${receipt.candidates.map((candidate) => candidate.filename).join(", ")}`,
	);
	const confirmation = process.argv
		.find((argument) => argument.startsWith("--confirm-candidates="))
		?.slice("--confirm-candidates=".length);
	if (confirmation !== receipt.candidateSha256) {
		throw new Error(
			"Candidate migration confirmation is missing or does not match the exact SHA-256.",
		);
	}
	try {
		const serviceEnvironment = await readServiceEnvironment();
		for (const candidate of receipt.candidates) {
			await cp(
				join(configuredPaths.migrationDirectory, candidate.filename),
				join(runtimeSupabaseDirectory, "migrations", candidate.filename),
			);
		}
		runLocalCommand(
			"supabase",
			["migration", "up", "--local", "--workdir", runtimeWorkdir],
			{ cwd: repositoryRoot, environment: serviceEnvironment },
		);
		const comparison = await verifyRuntimeMigrationHistory({
			baseline,
			currentFiles: receipt.currentFiles,
		});
		if (
			comparison.candidates
				.map((candidate) => candidate.filename)
				.join("\0") !==
			receipt.candidates.map((candidate) => candidate.filename).join("\0")
		) {
			throw new Error(
				"Applied Rehearsal migration history does not match the confirmed candidate suffix.",
			);
		}
		await writeFile(
			runtimeCandidateReceiptPath,
			`${JSON.stringify(
				{
					formatVersion: 1,
					baselineGenerationId: baseline.generationId,
					candidateSha256: receipt.candidateSha256,
					candidates: receipt.candidates.map((candidate) => ({
						filename: candidate.filename,
						sha256: candidate.fileSha256,
					})),
				},
				null,
				"\t",
			)}\n`,
			{ mode: 0o600 },
		);
		console.log(
			`Applied ${receipt.candidates.length} confirmed candidate migrations to the disposable Rehearsal runtime.`,
		);
		return receipt;
	} catch (error) {
		await removeRuntime().catch(() => undefined);
		throw error;
	}
};

switch (action) {
	case "reset":
		await resetRuntime();
		break;
	case "start": {
		const environment = await startRuntime();
		console.log(`Local Rehearsal Supabase: ${environment.apiUrl}`);
		break;
	}
	case "status": {
		const baseline = await verifyActiveBaseline({ artifactRoot });
		const receipt = await readCandidateReceipt(baseline);
		const serviceEnvironment = await readServiceEnvironment();
		const runtimeIsRunning = localCommandSucceeds(
			"supabase",
			["status", "--workdir", runtimeWorkdir],
			{ cwd: repositoryRoot, environment: serviceEnvironment },
		);
		if (runtimeIsRunning) {
			const environment = readLocalSupabaseEnvironment({
				cwd: repositoryRoot,
				workdir: runtimeWorkdir,
				environment: serviceEnvironment,
			});
			console.log(`Local Rehearsal Supabase: running at ${environment.apiUrl}`);
		} else {
			console.log("Local Rehearsal Supabase: stopped");
		}
		console.log(`Active sanitized baseline: ${baseline.generationId}`);
		console.log(
			`Candidate migrations (${receipt.candidateSha256}): ${receipt.candidates.map((candidate) => candidate.filename).join(", ") || "none"}`,
		);
		break;
	}
	case "candidates": {
		const baseline = await verifyActiveBaseline({ artifactRoot });
		const receipt = await readCandidateReceipt(baseline);
		console.log(
			`Candidate migrations (${receipt.candidateSha256}): ${receipt.candidates.map((candidate) => candidate.filename).join(", ") || "none"}`,
		);
		break;
	}
	case "migrate":
		await migrateRuntime();
		break;
	case "verify":
		await verifyRuntime();
		break;
	case "run":
		await resetRuntime();
		await migrateRuntime();
		await verifyRuntime();
		break;
	case "stop":
		stopLocalSupabase({
			cwd: repositoryRoot,
			workdir: runtimeWorkdir,
			environment: await readServiceEnvironment(),
		});
		break;
	case "discard":
		await removeRuntime();
		break;
	default:
		throw new Error(`Unknown Rehearsal database action: ${action}`);
}
