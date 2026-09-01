/**
 * Purpose: Run blendCalc's maintained quick, feature, or release verification
 * profile in a live terminal dashboard. The dashboard reports the current stage,
 * elapsed time, estimated remaining time, exact Playwright progress when available,
 * and pass/fail totals without replacing Vitest, Playwright, Svelte, database, or CI
 * ownership. Historical stage durations are stored only in the ignored local cache.
 * Run: `npm run verify:quick`, `npm run verify:feature`, or
 * `npm run verify:release`. Pass `--list --json` to inspect profile ownership.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	invalidateReleaseReceipt,
	recordReleaseReceipt,
} from "../../lib/quality/release_verification_receipt.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const historyPath = fileURLToPath(
	new URL(
		"../../../.cache/verification-dashboard-history.json",
		import.meta.url,
	),
);
const failureLogDirectory = fileURLToPath(
	new URL("../../../test-results/verification-dashboard", import.meta.url),
);
const ansiPattern = new RegExp(
	`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
	"g",
);
const terminalWidth = Math.max(72, Math.min(process.stdout.columns ?? 96, 120));

const stage = (
	id,
	label,
	command,
	args,
	estimatedMilliseconds,
	options = {},
) => ({
	id,
	label,
	command,
	args,
	estimatedMilliseconds,
	...options,
});

const sourceContractStages = [
	stage("versions", "Version contract", "npm", ["run", "version:check"], 3_000),
	stage("format", "Formatting", "npm", ["run", "format:check"], 8_000),
	stage("lint", "Lint", "npm", ["run", "lint"], 35_000),
	stage("types", "Svelte and TypeScript", "npm", ["run", "check"], 55_000),
];

const affectedUnitStage = stage(
	"vitest-affected",
	"Affected Vitest",
	"node",
	["scripts/operations/quality/run_affected_tests.mjs", "unit"],
	45_000,
	{ kind: "vitest" },
);

const fullUnitStages = [
	stage("vitest-node", "Vitest · Node", "npm", ["run", "test:node"], 45_000, {
		kind: "vitest",
	}),
	stage("vitest-dom", "Vitest · DOM", "npm", ["run", "test:dom"], 130_000, {
		kind: "vitest",
	}),
];

const compileOnlyPublicEnvironment = {
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_compile_only",
	PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
};

const buildStage = stage(
	"build",
	"Production build",
	"npm",
	["run", "build"],
	55_000,
	{ environment: compileOnlyPublicEnvironment },
);
const affectedBrowserStage = stage(
	"playwright-affected",
	"Affected browser flows",
	"node",
	["scripts/operations/quality/run_affected_tests.mjs", "browser", "--prepare"],
	180_000,
	{
		environment: { PLAYWRIGHT_PROGRESS_REPORTER: "line" },
		kind: "playwright",
	},
);
const browserMatrixStage = stage(
	"playwright-matrix",
	"Blocking browser tiers",
	"npx",
	["playwright", "test"],
	480_000,
	{
		environment: {
			PLAYWRIGHT_ENFORCE_DURATION_BUDGETS: "true",
			PLAYWRIGHT_PROGRESS_REPORTER: "line",
		},
		kind: "playwright",
	},
);
const exhaustiveBrowserMatrixStage = stage(
	"playwright-exhaustive",
	"Exhaustive browser matrix",
	"npx",
	["playwright", "test"],
	900_000,
	{
		environment: {
			PLAYWRIGHT_ENFORCE_DURATION_BUDGETS: "true",
			PLAYWRIGHT_EXHAUSTIVE_MATRIX: "true",
			PLAYWRIGHT_PROGRESS_REPORTER: "line",
		},
		kind: "playwright",
	},
);

export const verificationProfiles = {
	quick: {
		label: "Quick Check",
		description:
			"Source contracts plus unit tests selected from changed ownership.",
		stages: [...sourceContractStages, affectedUnitStage],
	},
	feature: {
		label: "Feature Check",
		description:
			"Source contracts, every unit test, and browser flows selected from changed ownership.",
		stages: [...sourceContractStages, ...fullUnitStages, affectedBrowserStage],
	},
	release: {
		label: "Release Check",
		description:
			"Dependency, source, database, build, and blocking browser-tier confidence.",
		stages: [
			stage(
				"dependencies",
				"Dependency audit",
				"npm",
				["audit", "--audit-level=high"],
				20_000,
			),
			...sourceContractStages,
			...fullUnitStages,
			buildStage,
			stage(
				"database",
				"Disposable database",
				"npm",
				["run", "db:test:verify"],
				240_000,
			),
			browserMatrixStage,
		],
	},
	nightly: {
		label: "Nightly Check",
		description:
			"Release confidence plus every test in all five browser/device projects.",
		stages: [
			stage(
				"dependencies",
				"Dependency audit",
				"npm",
				["audit", "--audit-level=high"],
				20_000,
			),
			...sourceContractStages,
			...fullUnitStages,
			buildStage,
			stage(
				"database",
				"Disposable database",
				"npm",
				["run", "db:test:verify"],
				240_000,
			),
			exhaustiveBrowserMatrixStage,
		],
	},
};

const formatDuration = (milliseconds) => {
	const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
		: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const stripTerminalFormatting = (value) =>
	value
		.replace(ansiPattern, "")
		.split("")
		.filter((character) => {
			const characterCode = character.charCodeAt(0);
			return characterCode === 9 || characterCode >= 32;
		})
		.join("");

const truncate = (value, maximumLength) =>
	value.length <= maximumLength
		? value
		: `${value.slice(0, Math.max(0, maximumLength - 1))}…`;

const readHistory = async () => {
	try {
		return JSON.parse(await readFile(historyPath, "utf8"));
	} catch {
		return {};
	}
};

const writeHistory = async (history) => {
	await mkdir(fileURLToPath(new URL("../../../.cache", import.meta.url)), {
		recursive: true,
	});
	await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, {
		mode: 0o600,
	});
};

const getStageEstimate = (verificationStage, history) => {
	const historicalDuration =
		history[verificationStage.id]?.durationMilliseconds;
	return Number.isFinite(historicalDuration) && historicalDuration > 0
		? historicalDuration
		: verificationStage.estimatedMilliseconds;
};

const makeProgressBar = (progress, width = 28) => {
	const boundedProgress = Math.max(0, Math.min(progress, 1));
	const completed = Math.round(width * boundedProgress);
	return `${"█".repeat(completed)}${"░".repeat(width - completed)}`;
};

const getStageProgress = (state, now) => {
	if (state.status === "passed" || state.status === "failed") return 1;
	if (state.status !== "running") return 0;
	if (state.testTotal && state.testCompleted !== null) {
		return Math.min(state.testCompleted / state.testTotal, 0.99);
	}
	return Math.min((now - state.startedAt) / state.estimatedMilliseconds, 0.95);
};

const renderDashboard = ({ profile, states, startedAt }) => {
	if (!process.stdout.isTTY) return;
	const now = Date.now();
	const weightedTotal = states.reduce(
		(total, state) => total + state.estimatedMilliseconds,
		0,
	);
	const weightedCompleted = states.reduce(
		(total, state) =>
			total + state.estimatedMilliseconds * getStageProgress(state, now),
		0,
	);
	const progress = weightedTotal ? weightedCompleted / weightedTotal : 0;
	const elapsed = now - startedAt;
	const estimatedRemaining = states.reduce((remaining, state) => {
		return (
			remaining +
			state.estimatedMilliseconds * (1 - getStageProgress(state, now))
		);
	}, 0);
	const passed = states.filter((state) => state.status === "passed").length;
	const failed = states.filter((state) => state.status === "failed").length;
	const runningState = states.find((state) => state.status === "running");

	const lines = [
		`blendCalc ${profile.label}`,
		`${makeProgressBar(progress)} ${String(Math.floor(progress * 100)).padStart(3)}%`,
		`Elapsed ${formatDuration(elapsed)}   Estimated remaining ${formatDuration(estimatedRemaining)}`,
		"",
	];

	for (const state of states) {
		const icon =
			state.status === "passed"
				? "✓"
				: state.status === "failed"
					? "✗"
					: state.status === "running"
						? "▶"
						: "○";
		const duration = state.finishedAt
			? formatDuration(state.finishedAt - state.startedAt)
			: state.status === "running"
				? formatDuration(now - state.startedAt)
				: "";
		const exactProgress = state.testTotal
			? `${state.testCompleted ?? 0}/${state.testTotal}`
			: "";
		lines.push(
			`${icon} ${state.label.padEnd(30)} ${exactProgress.padStart(10)} ${duration.padStart(8)}`,
		);
	}

	lines.push(
		"",
		`Stages passed ${passed}   Failed ${failed}   Remaining ${states.length - passed - failed}`,
	);
	if (runningState?.currentActivity) {
		lines.push(
			`Current: ${truncate(runningState.currentActivity, terminalWidth - 9)}`,
		);
	}
	lines.push("", "Press Ctrl+C to stop.");
	process.stdout.write(`\u001b[2J\u001b[H${lines.join("\n")}\n`);
};

const updateTestProgress = (state, line) => {
	const playwrightProgress = line.match(/\[(\d+)\/(\d+)\]/);
	if (playwrightProgress) {
		state.testCompleted = Number(playwrightProgress[1]);
		state.testTotal = Number(playwrightProgress[2]);
	}
	const vitestFile = line.match(
		/^[\s]*[✓✗×]\s+([^>]+?\.(?:test|spec)\.[cm]?[jt]sx?)(?:\s|$)/,
	);
	if (vitestFile) {
		state.testCompleted = (state.testCompleted ?? 0) + 1;
		state.currentActivity = vitestFile[1].trim();
		return;
	}
	if (playwrightProgress) {
		state.currentActivity = line.replace(/^.*?\]\s*/, "");
		return;
	}
	if (
		line &&
		!line.startsWith(">") &&
		!line.startsWith("npm ") &&
		!/^[-─═.·]+$/.test(line)
	) {
		state.currentActivity = line;
	}
};

const getChildProcessEnvironment = (stageEnvironment = {}) => {
	if (!process.env.FORCE_COLOR) {
		return { ...process.env, ...stageEnvironment };
	}

	const { NO_COLOR: _ignoredNoColor, ...environmentWithoutNoColor } =
		process.env;
	return { ...environmentWithoutNoColor, ...stageEnvironment };
};

const runStage = async (verificationStage, state, render) => {
	state.status = "running";
	state.startedAt = Date.now();
	state.currentActivity = `${verificationStage.command} ${verificationStage.args.join(" ")}`;
	render();

	const outputLines = [];
	let pendingOutput = "";
	const child = spawn(verificationStage.command, verificationStage.args, {
		cwd: repositoryRoot,
		env: getChildProcessEnvironment(verificationStage.environment),
		stdio: ["inherit", "pipe", "pipe"],
	});

	const consumeOutput = (chunk) => {
		pendingOutput += chunk.toString();
		const lines = pendingOutput.split(/[\r\n]+/);
		pendingOutput = lines.pop() ?? "";
		for (const rawLine of lines) {
			const line = stripTerminalFormatting(rawLine).trim();
			if (!line) continue;
			outputLines.push(line);
			updateTestProgress(state, line);
		}
		render();
	};

	child.stdout.on("data", consumeOutput);
	child.stderr.on("data", consumeOutput);
	const interrupt = () => child.kill("SIGINT");
	process.once("SIGINT", interrupt);
	const exitCode = await new Promise((resolve) => {
		child.on("error", () => resolve(1));
		child.on("close", (code, signal) => resolve(signal ? 130 : (code ?? 1)));
	});
	process.removeListener("SIGINT", interrupt);
	if (pendingOutput.trim()) {
		const line = stripTerminalFormatting(pendingOutput).trim();
		outputLines.push(line);
		updateTestProgress(state, line);
	}
	state.finishedAt = Date.now();
	state.status = exitCode === 0 ? "passed" : "failed";
	render();
	return { exitCode, outputLines };
};

const writeFailureLog = async (profileKey, stageId, outputLines) => {
	await mkdir(failureLogDirectory, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const logPath = `${failureLogDirectory}/${timestamp}-${profileKey}-${stageId}.log`;
	await writeFile(logPath, `${outputLines.join("\n")}\n`);
	return logPath;
};

const listProfiles = (asJson) => {
	const result = Object.fromEntries(
		Object.entries(verificationProfiles).map(([key, profile]) => [
			key,
			{
				label: profile.label,
				description: profile.description,
				stages: profile.stages.map(({ id, label }) => ({ id, label })),
			},
		]),
	);
	console.log(
		asJson
			? JSON.stringify(result, null, 2)
			: Object.entries(result)
					.map(
						([key, profile]) =>
							`${key}: ${profile.label}\n  ${profile.description}\n  ${profile.stages.map((item) => item.label).join(" → ")}`,
					)
					.join("\n\n"),
	);
};

const main = async () => {
	const args = process.argv.slice(2);
	if (args.includes("--list") || args.includes("--help")) {
		listProfiles(args.includes("--json"));
		return;
	}
	const profileKey = args[0] ?? "quick";
	const profile = verificationProfiles[profileKey];
	if (!profile) {
		console.error(
			`Unknown verification profile ${JSON.stringify(profileKey)}. Use quick, feature, release, or nightly.`,
		);
		process.exitCode = 2;
		return;
	}
	if (profileKey === "release") {
		await invalidateReleaseReceipt(repositoryRoot);
	}

	const history = await readHistory();
	const states = profile.stages.map((verificationStage) => ({
		...verificationStage,
		status: "pending",
		startedAt: 0,
		finishedAt: 0,
		estimatedMilliseconds: getStageEstimate(verificationStage, history),
		testCompleted: null,
		testTotal: null,
		currentActivity: "",
	}));
	const startedAt = Date.now();
	const render = () => renderDashboard({ profile, states, startedAt });
	let refreshTimer = null;
	if (process.stdout.isTTY) {
		refreshTimer = setInterval(render, 500);
		refreshTimer.unref();
	}

	for (let index = 0; index < profile.stages.length; index += 1) {
		const verificationStage = profile.stages[index];
		const state = states[index];
		if (!process.stdout.isTTY) {
			console.log(`[${index + 1}/${profile.stages.length}] ${state.label}`);
		}
		const result = await runStage(verificationStage, state, render);
		const durationMilliseconds = state.finishedAt - state.startedAt;
		history[verificationStage.id] = {
			durationMilliseconds,
			updatedAt: new Date().toISOString(),
		};
		await writeHistory(history);
		if (result.exitCode !== 0) {
			if (refreshTimer) clearInterval(refreshTimer);
			const logPath = await writeFailureLog(
				profileKey,
				verificationStage.id,
				result.outputLines,
			);
			render();
			console.error(
				`\n${state.label} failed after ${formatDuration(durationMilliseconds)}.`,
			);
			console.error(`Full diagnostics: ${logPath}`);
			console.error(result.outputLines.slice(-30).join("\n"));
			process.exitCode = result.exitCode;
			return;
		}
	}

	if (refreshTimer) clearInterval(refreshTimer);
	render();
	console.log(
		`\n${profile.label} passed in ${formatDuration(Date.now() - startedAt)}.`,
	);
	if (profileKey === "release") {
		const result = await recordReleaseReceipt(repositoryRoot);
		console.log(
			result.recorded
				? `Reusable promotion receipt recorded for tree ${result.receipt.tree}.`
				: `Promotion receipt not recorded: ${result.reason}`,
		);
	}
};

const isMainModule = process.argv[1]
	? fileURLToPath(import.meta.url) === resolve(process.argv[1])
	: false;

if (isMainModule) {
	await main();
}
