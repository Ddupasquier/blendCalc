/**
 * Purpose: Build the immutable, audit-only Rehearsal execution plan and readiness
 * report from project configuration and verified artifacts. Do not run directly;
 * this module is reusable script infrastructure.
 */

import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { verifyActiveBaseline } from "./baseline_artifact.mjs";
import {
	inspectDetectedProject,
	loadRehearsalConfig,
} from "./configuration.mjs";
import { createCandidateMigrationReceipt } from "./runtime_restore.mjs";
import { readMigrationFileInventory } from "./migration_history.mjs";
import { REHEARSAL_VERSION } from "./diagnostics.mjs";
import { readRehearsalServiceEnvironment } from "./service_environment.mjs";

const commandAvailable = (command, args = ["--version"]) => {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		env: Object.fromEntries(
			["HOME", "LANG", "LC_ALL", "PATH", "SHELL", "TMPDIR"].flatMap((key) =>
				process.env[key] === undefined ? [] : [[key, process.env[key]]],
			),
		),
		stdio: ["ignore", "pipe", "pipe"],
	});
	return {
		available: result.status === 0,
		version:
			result.status === 0
				? String(result.stdout || result.stderr).trim()
				: null,
	};
};

const isPortAvailable = (port) =>
	new Promise((resolveAvailability) => {
		const socket = createConnection({ host: "127.0.0.1", port });
		socket.unref();
		socket.setTimeout(500);
		socket.once("connect", () => {
			socket.destroy();
			resolveAvailability(false);
		});
		socket.once("error", () => resolveAvailability(true));
		socket.once("timeout", () => {
			socket.destroy();
			resolveAvailability(true);
		});
	});

const readRuntimeReceipt = async (runtimeWorkdir) => {
	try {
		return JSON.parse(
			await readFile(join(runtimeWorkdir, "candidate-receipt.json"), "utf8"),
		);
	} catch (error) {
		if (error?.code === "ENOENT") return null;
		return null;
	}
};

const verifyPath = async (path, kind) => {
	const details = await stat(path);
	if (kind === "directory" && !details.isDirectory()) {
		throw new Error(`Expected a directory at ${path}.`);
	}
	if (kind === "file" && !details.isFile()) {
		throw new Error(`Expected a file at ${path}.`);
	}
	return details;
};

const resultCheck = async ({ id, label, run, remediation }) => {
	const startedAt = performance.now();
	try {
		const detail = await run();
		return {
			id,
			label,
			status: "pass",
			detail,
			durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
		};
	} catch (error) {
		return {
			id,
			label,
			status: "fail",
			detail: String(error?.message ?? error),
			remediation,
			durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
		};
	}
};

const assertRuntimeConfigMatches = async ({ config, paths }) => {
	const source = await readFile(paths.rehearsalConfig, "utf8");
	const expected = [
		["project_id", config.runtime.projectId],
		["port", config.runtime.ports.api],
		["port", config.runtime.ports.database],
		["port", config.runtime.ports.studio],
	];
	for (const [, value] of expected) {
		if (!source.includes(String(value))) {
			throw new Error(`Local Supabase config does not declare ${value}.`);
		}
	}
	if (/\blinked\s*=\s*true\b/iu.test(source)) {
		throw new Error(
			"Local Supabase config unexpectedly enables a linked target.",
		);
	}
	return "isolated Supabase project and ports match the project contract";
};

const assertBaselinePermissions = async ({ paths }) => {
	const details = await stat(paths.dataPath);
	if ((details.mode & 0o077) !== 0) {
		throw new Error(
			"Sanitized baseline data is readable by group or other users.",
		);
	}
	return "baseline data is owner-only";
};

const baselineCreatedAt = (generationId) => {
	const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/u.exec(
		generationId,
	);
	return match
		? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`
		: null;
};

const assertConfiguredCommand = async ({ command, projectRoot }) => {
	const match = /^(npm|pnpm|yarn)\s+(?:run\s+)?([^\s]+)/u.exec(command);
	if (!match) return `declared command: ${command}`;
	const packageJson = JSON.parse(
		await readFile(join(projectRoot, "package.json"), "utf8"),
	);
	const scriptName = match[2];
	if (!packageJson.scripts?.[scriptName]) {
		throw new Error(`package.json has no ${scriptName} script.`);
	}
	return `package script ${scriptName} exists`;
};

const loadPlanInputs = async (options = {}) => {
	const loaded = await loadRehearsalConfig(options);
	const baseline = await verifyActiveBaseline({
		artifactRoot: loaded.paths.artifactDirectory,
	});
	const currentFiles = await readMigrationFileInventory(
		new URL("./", pathToFileURL(`${loaded.paths.migrationDirectory}/`)),
	);
	const candidateReceipt = createCandidateMigrationReceipt({
		baselineManifest: baseline,
		currentFiles,
	});
	const runtimeReceipt = await readRuntimeReceipt(loaded.paths.runtimeWorkdir);
	const appliedCandidateDigest =
		runtimeReceipt?.baselineGenerationId === baseline.generationId &&
		runtimeReceipt?.candidateSha256 === candidateReceipt.candidateSha256
			? candidateReceipt.candidateSha256
			: null;
	const baselineNames = new Set(Object.keys(baseline.migrations));
	const candidateNames = new Set(
		candidateReceipt.candidates.map((entry) => entry.filename),
	);
	const migrations = currentFiles.map((entry) => ({
		version: entry.version,
		name: entry.name,
		filename: entry.filename,
		sha256: entry.fileSha256,
		status: baselineNames.has(entry.filename)
			? "represented_by_baseline"
			: candidateNames.has(entry.filename) && appliedCandidateDigest
				? "applied_to_current_runtime"
				: "candidate",
	}));
	return {
		...loaded,
		baseline,
		currentFiles,
		candidateReceipt,
		migrations,
	};
};

export const buildRehearsalPlan = async (options = {}) => {
	const inputs = await loadPlanInputs(options);
	const { baseline, candidateReceipt, config, configPath, migrations, paths } =
		inputs;
	return {
		config: {
			schemaVersion: config.schemaVersion,
			path: configPath,
			project: config.project.name,
		},
		environment: {
			kind: "isolated_local_supabase",
			applicationUrl: config.runtime.applicationUrl,
			projectId: config.runtime.projectId,
			ports: config.runtime.ports,
			hostedAccess: config.safety.hostedAccess,
			outboundNetwork: config.safety.outboundNetwork,
			authenticationProviders: config.safety.authenticationProviders,
			barriers: [
				"versioned configuration accepts loopback hosts only",
				"runtime uses a dedicated local Supabase workdir and project id",
				"child processes receive an allowlisted environment",
				"application egress policy denies hosted targets and side effects",
				...(config.safety.authenticationProviders.length
					? [
							`external identity is limited to: ${config.safety.authenticationProviders.join(", ")}`,
						]
					: []),
			],
		},
		baseline: {
			rehearsalVersion: REHEARSAL_VERSION,
			formatVersion: baseline.formatVersion,
			generationId: baseline.generationId,
			createdAt: baselineCreatedAt(baseline.generationId),
			migrationCutoff: baseline.migrationCutoff,
			migrationHistorySha256: baseline.migrationHistorySha256 ?? null,
			sanitizationPolicySha256: baseline.sanitizationPolicySha256,
			dataSha256: baseline.files["sanitized-data.ndjson"].sha256,
			tableCount: Object.keys(baseline.tableCounts).length,
			rowCount: baseline.rowCount,
			migrationCount: Object.keys(baseline.migrations).length,
			verification: "checksums_verified",
		},
		migrations: {
			representedCount: migrations.filter(
				(entry) => entry.status === "represented_by_baseline",
			).length,
			candidateCount: candidateReceipt.candidates.length,
			candidateSha256: candidateReceipt.candidateSha256,
			candidates: candidateReceipt.candidates.map((entry) => ({
				filename: entry.filename,
				sha256: entry.fileSha256,
			})),
		},
		execution: [
			"verify the sanitized baseline and immutable migration prefix",
			"replace the disposable local Rehearsal runtime",
			"restore and verify exact table counts plus foreign keys",
			...(candidateReceipt.candidates.length
				? ["apply only the exact candidate migration digest"]
				: ["confirm that no candidate migrations are pending"]),
			"verify the resulting migration ledger and database state",
			`run application proof: ${config.application.proofCommand}`,
		],
		guarantee: config.safety.authenticationProviders.length
			? "No hosted application or database resources will be contacted; the declared identity-provider exchange creates state only in local Auth."
			: "No production resources will be contacted.",
		paths: {
			artifactDirectory: paths.artifactDirectory,
			migrationDirectory: paths.migrationDirectory,
			sanitizationPolicy: paths.sanitizationPolicy,
		},
	};
};

export const inspectRehearsalBaseline = async (options = {}) => {
	const plan = await buildRehearsalPlan(options);
	return {
		...plan.baseline,
		project: plan.config.project,
		provenance: {
			configVersion: plan.config.schemaVersion,
			migrationCutoff: plan.baseline.migrationCutoff,
			sanitizationPolicySha256: plan.baseline.sanitizationPolicySha256,
		},
		privacy: {
			sourceRowsExposed: false,
			sensitiveValuesIncludedInReport: false,
		},
	};
};

export const inspectRehearsalMigrations = async (options = {}) => {
	const inputs = await loadPlanInputs(options);
	return {
		baselineGenerationId: inputs.baseline.generationId,
		baselineCutoff: inputs.baseline.migrationCutoff,
		candidateSha256: inputs.candidateReceipt.candidateSha256,
		migrations: inputs.migrations,
		definitions: {
			represented_by_baseline:
				"Exact filename and SHA-256 are part of the verified baseline prefix.",
			applied_to_current_runtime:
				"The exact current candidate digest has a verified local runtime receipt.",
			candidate:
				"The file follows the exact baseline prefix and has not been proven in the current runtime.",
			modified:
				"A baseline-prefix filename or digest differs; planning fails before this report can be trusted.",
			invalid:
				"The migration filename, ordering, uniqueness, or source shape is invalid; planning fails closed.",
		},
	};
};

export const runRehearsalDoctor = async (options = {}) => {
	let loaded;
	try {
		loaded = await loadRehearsalConfig(options);
	} catch (error) {
		return {
			state: "NOT READY",
			checks: [
				{
					id: "configuration",
					label: "Versioned configuration",
					status: "fail",
					detail: String(error?.message ?? error),
					remediation:
						"Run rehearsal init, review the preview, then write a valid configuration.",
				},
			],
		};
	}
	const { config, paths, projectRoot } = loaded;
	const nodeMajor = Number(process.versions.node.split(".")[0]);
	const checkDefinitions = [
		{
			id: "node",
			label: "Node.js compatibility",
			run: async () => {
				if (nodeMajor !== 24)
					throw new Error(`Node ${process.versions.node} is unsupported.`);
				return `Node ${process.versions.node}`;
			},
			remediation: "Use Node.js 24.",
		},
		{
			id: "operating-system",
			label: "Operating-system support",
			run: async () => {
				if (!["darwin", "linux"].includes(process.platform)) {
					throw new Error(
						`${process.platform} is not supported by the version-1 contract.`,
					);
				}
				return `${process.platform} is in the supported matrix`;
			},
			remediation:
				"Use macOS or Linux; WSL and native Windows require separate proof before support.",
		},
		{
			id: "package-manager",
			label: "Package-manager support",
			run: async () => {
				const detected = await inspectDetectedProject({ projectRoot });
				if (detected.packageManager !== "npm") {
					throw new Error(
						`${detected.packageManager} is detected but not yet supported.`,
					);
				}
				return "npm";
			},
			remediation: "Use npm for the initial Rehearsal contract.",
		},
		{
			id: "supabase-cli",
			label: "Supabase CLI",
			run: async () => {
				const result = commandAvailable("supabase");
				if (!result.available) throw new Error("Supabase CLI is unavailable.");
				return result.version;
			},
			remediation: "Install the Supabase CLI in the project and retry.",
		},
		{
			id: "docker",
			label: "Docker-compatible runtime",
			run: async () => {
				const result = commandAvailable("docker", [
					"info",
					"--format",
					"{{.ServerVersion}}",
				]);
				if (!result.available)
					throw new Error("Docker-compatible runtime is unavailable.");
				return `Docker ${result.version}`;
			},
			remediation: "Start Docker or Colima, then retry.",
		},
		{
			id: "paths",
			label: "Project-owned paths",
			run: async () => {
				await Promise.all([
					verifyPath(paths.migrationDirectory, "directory"),
					verifyPath(paths.rehearsalConfig, "file"),
					verifyPath(paths.sanitizationPolicy, "file"),
					...(paths.runtimeAdapter
						? [verifyPath(paths.runtimeAdapter, "file")]
						: []),
				]);
				return "migrations, local runtime config, and sanitization policy exist";
			},
			remediation:
				"Correct the missing project path in the Rehearsal configuration.",
		},
		{
			id: "runtime-isolation",
			label: "Runtime target isolation",
			run: () => assertRuntimeConfigMatches({ config, paths }),
			remediation:
				"Use a dedicated unlinked local Supabase config whose ports match rehearsal.config.",
		},
		{
			id: "service-environment",
			label: "Local service credentials",
			run: async () => {
				const environment = await readRehearsalServiceEnvironment({
					path: paths.serviceEnvironment,
					keys: config.supabase.serviceEnvironmentVariables,
					blockedKeys: config.safety.blockedEnvironmentVariables,
				});
				const count = Object.keys(environment).length;
				return count
					? `${count} explicitly allowlisted local service variables loaded`
					: "no local service credentials required";
			},
			remediation:
				"Create the configured ignored service environment file, add only its allowlisted values, and chmod it to 600.",
		},
		{
			id: "runtime-ports",
			label: "Dedicated local ports",
			run: async () => {
				const availability = await Promise.all(
					Object.entries(config.runtime.ports).map(async ([name, port]) => ({
						name,
						port,
						available: await isPortAvailable(port),
					})),
				);
				const occupied = availability.filter((entry) => !entry.available);
				if (occupied.length) {
					const serviceEnvironment = await readRehearsalServiceEnvironment({
						path: paths.serviceEnvironment,
						keys: config.supabase.serviceEnvironmentVariables,
						blockedKeys: config.safety.blockedEnvironmentVariables,
					});
					const status = spawnSync(
						"supabase",
						["status", "-o", "env", "--workdir", paths.runtimeWorkdir],
						{
							cwd: projectRoot,
							encoding: "utf8",
							env: {
								...Object.fromEntries(
									["HOME", "LANG", "LC_ALL", "PATH", "SHELL", "TMPDIR"].flatMap(
										(key) =>
											process.env[key] === undefined
												? []
												: [[key, process.env[key]]],
									),
								),
								...serviceEnvironment,
							},
							stdio: ["ignore", "pipe", "pipe"],
						},
					);
					if (
						status.status !== 0 ||
						!String(status.stdout).includes(
							`API_URL="http://127.0.0.1:${config.runtime.ports.api}"`,
						)
					) {
						throw new Error(
							`Configured ports are occupied by an unverified process: ${occupied.map(({ name, port }) => `${name}=${port}`).join(", ")}.`,
						);
					}
					return "occupied only by the configured local Rehearsal runtime";
				}
				return "all configured ports are available";
			},
			remediation:
				"Stop the conflicting process or choose a unique local Rehearsal port set.",
		},
		{
			id: "baseline",
			label: "Baseline integrity",
			run: async () => {
				const baseline = await verifyActiveBaseline({
					artifactRoot: paths.artifactDirectory,
				});
				return `${baseline.generationId}; ${baseline.rowCount} rows; checksums verified`;
			},
			remediation:
				"Create or restore a verified sanitized baseline before running Rehearsal.",
		},
		{
			id: "baseline-permissions",
			label: "Baseline file permissions",
			run: async () => {
				const baseline = await verifyActiveBaseline({
					artifactRoot: paths.artifactDirectory,
				});
				return assertBaselinePermissions({
					paths: {
						dataPath: join(
							paths.artifactDirectory,
							"generations",
							baseline.generationId,
							"sanitized-data.ndjson",
						),
					},
				});
			},
			remediation:
				"Restrict baseline files to the current user, then rebuild the artifact.",
		},
		{
			id: "migration-history",
			label: "Migration history",
			run: async () => {
				const plan = await buildRehearsalPlan(options);
				return `${plan.migrations.representedCount} represented; ${plan.migrations.candidateCount} candidates; digest ${plan.migrations.candidateSha256}`;
			},
			remediation:
				"Restore the exact migration prefix or create a new reviewed baseline.",
		},
		{
			id: "application-command",
			label: "Application commands",
			run: async () => {
				const start = await assertConfiguredCommand({
					command: config.application.startCommand,
					projectRoot,
				});
				const proof = await assertConfiguredCommand({
					command: config.application.proofCommand,
					projectRoot,
				});
				return `${start}; ${proof}`;
			},
			remediation:
				"Declare existing project commands for application launch and proof.",
		},
		{
			id: "safety-policy",
			label: "Hosted access and side effects",
			run: async () => {
				if (
					config.safety.hostedAccess !== "disabled" ||
					config.safety.outboundNetwork !== "deny"
				) {
					throw new Error("The safety policy is not fail closed.");
				}
				return config.safety.authenticationProviders.length
					? `hosted access disabled; application egress denied; identity providers: ${config.safety.authenticationProviders.join(", ")}`
					: "hosted access disabled; outbound network denied";
			},
			remediation: "Restore the version-1 fail-closed safety policy.",
		},
	];
	const checks = [];
	for (const definition of checkDefinitions) {
		checks.push(await resultCheck(definition));
	}
	return {
		state: checks.every((check) => check.status === "pass")
			? "READY"
			: "NOT READY",
		checks,
		ambientHostedVariables: {
			presentButQuarantined: config.safety.blockedEnvironmentVariables.filter(
				(key) => Boolean(process.env[key]?.trim()),
			),
			note: "Blocked ambient values are not inherited by Rehearsal child processes.",
		},
	};
};
