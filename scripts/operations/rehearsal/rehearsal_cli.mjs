#!/usr/bin/env node
/**
 * Purpose: Run the versioned, project-configured Rehearsal developer CLI for
 * initialization, readiness, planning, inspection, and verified local execution.
 * Run: `npm run rehearsal -- doctor` or `npm run rehearsal -- explain`.
 */

import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
	RehearsalError,
	createRehearsalResult,
	normalizeRehearsalError,
	redactDiagnosticValue,
	renderHumanError,
	serializeRehearsalError,
} from "../../lib/rehearsal/diagnostics.mjs";
import {
	inspectDetectedProject,
	findRehearsalConfigPath,
	loadRehearsalConfig,
	renderDetectedConfig,
} from "../../lib/rehearsal/configuration.mjs";
import {
	buildRehearsalPlan,
	inspectRehearsalBaseline,
	inspectRehearsalMigrations,
	runRehearsalDoctor,
} from "../../lib/rehearsal/plan.mjs";

const packageRoot = fileURLToPath(new URL("../../..", import.meta.url));
const projectRoot = process.cwd();
const commandStartedAt = new Date();
const commandStartedMs = performance.now();
const managerPath = join(
	packageRoot,
	"scripts/operations/database/manage_rehearsal_database.mjs",
);

const parseArguments = (arguments_) => {
	const flags = {
		json: false,
		help: false,
		verbosity: "normal",
		dryRun: false,
		write: false,
		configPath: undefined,
		confirmation: undefined,
	};
	const positionals = [];
	for (const argument of arguments_) {
		if (argument === "--json") flags.json = true;
		else if (argument === "--help" || argument === "-h") flags.help = true;
		else if (argument === "--verbose") flags.verbosity = "verbose";
		else if (argument === "--debug") flags.verbosity = "debug";
		else if (argument === "--dry-run") flags.dryRun = true;
		else if (argument === "--write") flags.write = true;
		else if (argument.startsWith("--config=")) {
			flags.configPath = argument.slice("--config=".length);
		} else if (argument.startsWith("--confirm-candidates=")) {
			flags.confirmation = argument.slice("--confirm-candidates=".length);
		} else if (argument.startsWith("--")) {
			throw new Error(`Unknown Rehearsal option: ${argument}.`);
		} else positionals.push(argument);
	}
	return { flags, positionals };
};

const renderPlan = (plan, verbosity) => {
	const candidates = plan.migrations.candidates.length
		? plan.migrations.candidates
				.map((entry) => `  → ${entry.filename} (${entry.sha256.slice(0, 12)})`)
				.join("\n")
		: "  ✓ No candidate migrations";
	const verbose =
		verbosity === "normal"
			? []
			: [
					"",
					"Safety barriers",
					...plan.environment.barriers.map((barrier) => `  ✓ ${barrier}`),
					`  ✓ Candidate digest: ${plan.migrations.candidateSha256}`,
				];
	return [
		"REHEARSAL PLAN",
		"",
		"Environment",
		`  ✓ ${plan.environment.kind}`,
		`  ✓ Hosted access ${plan.environment.hostedAccess}`,
		`  ✓ Application/provider-data egress ${plan.environment.outboundNetwork}`,
		...(plan.environment.authenticationProviders.length
			? [
					`  ✓ External identity providers ${plan.environment.authenticationProviders.join(", ")}`,
				]
			: []),
		"",
		"Baseline",
		`  ✓ ${plan.baseline.generationId}`,
		`  ✓ ${plan.baseline.tableCount} tables; ${plan.baseline.rowCount} rows`,
		`  ✓ ${plan.baseline.verification}`,
		"",
		"Migrations",
		`  ✓ ${plan.migrations.representedCount} represented by baseline`,
		candidates,
		"",
		"Execution plan",
		...plan.execution.map((step, index) => `  ${index + 1}. ${step}`),
		...verbose,
		"",
		plan.guarantee,
	].join("\n");
};

const renderDoctor = (doctor, verbosity) => {
	const lines = doctor.checks.map((check) => {
		const marker = check.status === "pass" ? "✓" : "✗";
		const detail =
			verbosity === "normal" && check.status === "pass"
				? ""
				: ` — ${check.detail}`;
		return `${marker} ${check.label}${detail}`;
	});
	for (const check of doctor.checks.filter(
		(entry) => entry.status === "fail",
	)) {
		if (check.remediation) lines.push(`  Try: ${check.remediation}`);
	}
	if (doctor.ambientHostedVariables.presentButQuarantined.length) {
		lines.push(
			`! ${doctor.ambientHostedVariables.presentButQuarantined.length} ambient hosted credential variables detected and quarantined.`,
		);
	}
	return [...lines, "", doctor.state].join("\n");
};

const renderBaseline = (baseline) =>
	[
		"REHEARSAL BASELINE",
		`Rehearsal: ${baseline.rehearsalVersion}`,
		`Generation: ${baseline.generationId}`,
		`Created: ${baseline.createdAt ?? "unknown"}`,
		`Format: ${baseline.formatVersion}`,
		`Tables: ${baseline.tableCount}`,
		`Rows: ${baseline.rowCount}`,
		`Migrations: ${baseline.migrationCount} through ${baseline.migrationCutoff}`,
		`Data SHA-256: ${baseline.dataSha256}`,
		`Sanitization policy SHA-256: ${baseline.sanitizationPolicySha256}`,
		`Verification: ${baseline.verification}`,
		"Source rows and sensitive values are never printed by inspect.",
	].join("\n");

const renderMigrations = (inspection, verbosity) => {
	const entries = inspection.migrations.map((migration) => {
		const digest = verbosity === "normal" ? "" : ` (${migration.sha256})`;
		return `${migration.status.padEnd(28)} ${migration.filename}${digest}`;
	});
	return [
		"REHEARSAL MIGRATIONS",
		`Baseline: ${inspection.baselineGenerationId} through ${inspection.baselineCutoff}`,
		`Candidate digest: ${inspection.candidateSha256}`,
		"",
		...entries,
	].join("\n");
};

const candidateSummary = (inspection) => {
	const candidates = inspection.migrations.filter(
		(migration) => migration.status === "candidate",
	);
	return {
		baselineGenerationId: inspection.baselineGenerationId,
		candidateSha256: inspection.candidateSha256,
		candidateCount: candidates.length,
		candidates,
	};
};

const renderCandidates = (summary, verbosity) =>
	[
		"REHEARSAL CANDIDATES",
		`Baseline: ${summary.baselineGenerationId}`,
		`Candidate digest: ${summary.candidateSha256}`,
		`Pending: ${summary.candidateCount}`,
		...(summary.candidates.length
			? summary.candidates.map((migration) =>
					verbosity === "normal"
						? `  → ${migration.filename}`
						: `  → ${migration.filename} (${migration.sha256})`,
				)
			: ["  ✓ No candidate migrations"]),
	].join("\n");

const emit = ({ command, data, flags, render, status = "success" }) => {
	const result = createRehearsalResult({
		command,
		status,
		data,
		startedAt: commandStartedAt,
		durationMs: Math.round((performance.now() - commandStartedMs) * 100) / 100,
	});
	if (flags.json) console.log(JSON.stringify(result, null, 2));
	else console.log(render(data, flags.verbosity));
};

const runManager = ({ action, flags }) => {
	const args = [managerPath, action];
	if (flags.confirmation) {
		args.push(`--confirm-candidates=${flags.confirmation}`);
	}
	const environment = Object.fromEntries(
		[
			"CI",
			"COLORTERM",
			"FORCE_COLOR",
			"HOME",
			"LANG",
			"LC_ALL",
			"NO_COLOR",
			"PATH",
			"SHELL",
			"TERM",
			"TMPDIR",
			"USER",
		].flatMap((key) =>
			process.env[key] === undefined ? [] : [[key, process.env[key]]],
		),
	);
	const result = spawnSync(process.execPath, args, {
		cwd: projectRoot,
		encoding: "utf8",
		env: environment,
		stdio: ["inherit", "pipe", "pipe"],
		maxBuffer: 16 * 1024 * 1024,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		const completeOutput = [
			String(result.stdout ?? ""),
			String(result.stderr ?? ""),
		]
			.filter(Boolean)
			.join("\n")
			.trim();
		const inferred = normalizeRehearsalError(
			new Error(completeOutput || `Rehearsal ${action} failed.`),
		);
		const conciseOutput = completeOutput
			.replaceAll(String.fromCodePoint(27), "")
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(-8)
			.join("\n")
			.slice(-2_000);
		throw new RehearsalError({
			category: inferred.category,
			code: `MANAGER_${action.toUpperCase()}_FAILED`,
			message: `The local Rehearsal ${action} operation did not complete.`,
			expected: "the isolated runtime operation to finish and verify",
			actual: conciseOutput || `exit ${result.status}`,
			context: { action },
			refused: "The runtime was not reported as trusted.",
			suggestions: [
				"Review the concise failure above, then rerun rehearsal doctor before retrying.",
				"Use --debug only when the safe diagnostic detail is needed.",
			],
			cause: new Error(completeOutput || `exit ${result.status}`),
		});
	}
	return {
		action,
		output: redactDiagnosticValue(String(result.stdout ?? "").trim()),
	};
};

const parseCommand = (source) => {
	const values = [];
	let current = "";
	let quote = null;
	for (const character of source) {
		if (quote) {
			if (character === quote) quote = null;
			else current += character;
		} else if (character === '"' || character === "'") quote = character;
		else if (/\s/u.test(character)) {
			if (current) values.push(current);
			current = "";
		} else current += character;
	}
	if (quote)
		throw new Error("Application proof command contains an unmatched quote.");
	if (current) values.push(current);
	if (values.length === 0)
		throw new Error("Application proof command is empty.");
	return values;
};

const runApplicationProof = async (planOptions) => {
	const { config, projectRoot: configuredRoot } =
		await loadRehearsalConfig(planOptions);
	const [command, ...args] = parseCommand(config.application.proofCommand);
	const environment = Object.fromEntries(
		[
			"CI",
			"COLORTERM",
			"FORCE_COLOR",
			"HOME",
			"LANG",
			"LC_ALL",
			"NO_COLOR",
			"PATH",
			"SHELL",
			"TERM",
			"TMPDIR",
			"USER",
		].flatMap((key) =>
			process.env[key] === undefined ? [] : [[key, process.env[key]]],
		),
	);
	const result = spawnSync(command, args, {
		cwd: configuredRoot,
		encoding: "utf8",
		env: environment,
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 16 * 1024 * 1024,
	});
	if (result.error || result.status !== 0) {
		throw new RehearsalError({
			category: "application_proof_failure",
			code: "APPLICATION_PROOF_FAILED",
			message: "The configured application proof did not pass.",
			expected: `${config.application.proofCommand} exits successfully`,
			actual: result.error?.message ?? result.stderr ?? `exit ${result.status}`,
			context: { project: config.project.name },
			refused:
				"Rehearsal did not report the migrated runtime as fully verified.",
			suggestions: [
				"Run the proof command directly in the same project and correct the failure.",
			],
			cause: result.error,
		});
	}
	return {
		command: config.application.proofCommand,
		output: redactDiagnosticValue(String(result.stdout ?? "").trim()),
	};
};

const runInit = async ({ flags }) => {
	const detected = await inspectDetectedProject({ projectRoot });
	const source = renderDetectedConfig(detected);
	const destination = join(projectRoot, "rehearsal.config.ts");
	let existingPath = null;
	try {
		existingPath = await findRehearsalConfigPath({ projectRoot });
	} catch (error) {
		if (
			!String(error?.message ?? error).startsWith("No Rehearsal configuration")
		) {
			throw error;
		}
	}
	if (existingPath) {
		if (flags.write) {
			throw new Error(
				`A Rehearsal configuration already exists at ${relative(projectRoot, existingPath)}; Rehearsal will not overwrite it.`,
			);
		}
		return {
			mode: "existing",
			destination: relative(projectRoot, existingPath),
			detected,
			source: "",
			nextAction:
				"Review the existing configuration, then run rehearsal doctor.",
		};
	}
	if (flags.write)
		await writeFile(destination, source, { flag: "wx", mode: 0o600 });
	return {
		mode: flags.write ? "written" : "preview",
		destination: relative(projectRoot, destination),
		detected,
		source,
		nextAction: flags.write
			? "Review the generated safety settings and run rehearsal doctor."
			: "Review this preview, then rerun rehearsal init --write to create it.",
	};
};

const renderInit = (result) =>
	[
		`REHEARSAL INIT — ${result.mode.toUpperCase()}`,
		`Destination: ${result.destination}`,
		`Detected package manager: ${result.detected.packageManager}`,
		`Detected Supabase config: ${result.detected.hasSupabaseConfig ? "yes" : "no"}`,
		`Detected migrations: ${result.detected.hasMigrations ? "yes" : "no"}`,
		...(result.source ? ["", result.source] : []),
		result.nextAction,
	].join("\n");

const usage = () => `Usage: rehearsal <command> [options]

Commands:
  init [--write]              Preview or explicitly write safe starter config
  doctor                     Check whether Rehearsal is safe and ready
  explain                    Show the immutable execution plan
  run --dry-run              Alias the exact explain plan without mutations
  run --confirm-candidates=  Execute reset, migration, and verification locally
  candidates                 Show the exact pending migration digest
  inspect baseline           Show verified baseline provenance
  inspect migrations         Classify represented, applied, and candidate migrations
  verify                     Verify the current local Rehearsal runtime

Options: --json --verbose --debug --config=<path>`;

const main = async () => {
	const { flags, positionals } = parseArguments(process.argv.slice(2));
	const command = positionals.join(" ") || "help";
	const planOptions = {
		projectRoot,
		configPath: flags.configPath,
	};
	if (command === "help" || flags.help) {
		console.log(usage());
		return;
	}
	if (command === "init") {
		const data = await runInit({ flags });
		emit({ command, data, flags, render: renderInit });
		return;
	}
	if (command === "doctor") {
		const data = await runRehearsalDoctor(planOptions);
		emit({
			command,
			data,
			flags,
			render: renderDoctor,
			status: data.state === "READY" ? "success" : "not_ready",
		});
		if (data.state !== "READY") process.exitCode = 1;
		return;
	}
	if (command === "explain" || (command === "run" && flags.dryRun)) {
		const data = await buildRehearsalPlan(planOptions);
		emit({ command, data, flags, render: renderPlan });
		return;
	}
	if (command === "inspect baseline") {
		const data = await inspectRehearsalBaseline(planOptions);
		emit({ command, data, flags, render: renderBaseline });
		return;
	}
	if (command === "inspect migrations") {
		const data = await inspectRehearsalMigrations(planOptions);
		emit({ command, data, flags, render: renderMigrations });
		return;
	}
	if (command === "candidates") {
		const data = candidateSummary(
			await inspectRehearsalMigrations(planOptions),
		);
		emit({ command, data, flags, render: renderCandidates });
		return;
	}
	if (command === "run" || command === "verify") {
		if (flags.dryRun && command !== "run") {
			throw new Error("--dry-run is supported only by rehearsal run.");
		}
		const runtime = runManager({ action: command, flags });
		const data =
			command === "run"
				? {
						runtime,
						applicationProof: await runApplicationProof(planOptions),
					}
				: runtime;
		emit({
			command,
			data,
			flags,
			render: (value) => {
				const runtimeResult = value.runtime ?? value;
				return [
					runtimeResult.output ||
						`Rehearsal ${runtimeResult.action} completed.`,
					value.applicationProof
						? `Application proof passed: ${value.applicationProof.command}`
						: null,
				]
					.filter(Boolean)
					.join("\n");
			},
		});
		return;
	}
	throw new Error(`Unknown Rehearsal command: ${command}.\n\n${usage()}`);
};

try {
	await main();
} catch (error) {
	const failure = normalizeRehearsalError(error, {
		expected: "a safe, versioned, local-only Rehearsal operation",
		actual: String(error?.message ?? error),
		refused: "No further Rehearsal action was performed.",
		suggestions: ["Run rehearsal doctor for actionable readiness checks."],
	});
	const wantsJson = process.argv.includes("--json");
	const debug = process.argv.includes("--debug");
	if (wantsJson)
		console.log(
			JSON.stringify(serializeRehearsalError(failure, { debug }), null, 2),
		);
	else console.error(renderHumanError(failure, { debug }));
	process.exitCode = failure.exitCode;
}
