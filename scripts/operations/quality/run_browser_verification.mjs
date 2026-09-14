/**
 * Purpose: Prepare, run, and always clean up a bounded Playwright verification pass.
 * Run: `npm run test:e2e` or another maintained `test:e2e*` npm command.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import {
	assertLoopbackUrl,
	createCleanProcessEnvironment,
	createSafeLocalApplicationEnvironment,
} from "../../lib/environment/runtime_environment.mjs";
import {
	readLocalSupabaseEnvironment,
	startLocalSupabase,
	stopLocalSupabase,
} from "../../lib/environment/local_supabase.mjs";
import { assertLocalResourceSafety } from "../../lib/quality/resource_safety.mjs";
import { withNodeHeapLimit } from "./run_with_resource_limits.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

const runCommand = (command, args, environment) =>
	spawnSync(command, args, {
		cwd: repositoryRoot,
		env: environment,
		stdio: "inherit",
	}).status ?? 1;

export const main = (playwrightArguments = process.argv.slice(2)) => {
	assertLocalResourceSafety();
	const preparationEnvironment = createCleanProcessEnvironment({
		passthroughKeys: ["BLENDCALC_ALLOW_RESOURCE_PRESSURE"],
		overrides: {
			BLENDCALC_RUNTIME_ENVIRONMENT: "test",
			NODE_OPTIONS: withNodeHeapLimit(process.env.NODE_OPTIONS),
		},
	});
	let exitCode = runCommand(
		"npm",
		["run", "test:e2e:prepare"],
		preparationEnvironment,
	);
	try {
		if (exitCode === 0) {
			const applicationSupabase = readLocalSupabaseEnvironment({
				cwd: repositoryRoot,
			});
			const blendCalcAPISupabase = startLocalSupabase({
				cwd: repositoryRoot,
				workdir: "infrastructure/blendCalcAPI",
			});
			const testEnvironment = parse(
				readFileSync(resolve(repositoryRoot, ".env.test.local")),
			);
			const playwrightBaseUrl =
				process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174";
			assertLoopbackUrl("PLAYWRIGHT_BASE_URL", playwrightBaseUrl);
			const environment = createSafeLocalApplicationEnvironment({
				runtimeEnvironment: "test",
				applicationUrl: "http://localhost:5174",
				applicationSupabase,
				blendCalcAPISupabase,
				additionalEnvironment: {
					...testEnvironment,
					BLENDCALC_RUNTIME_ENVIRONMENT: "test",
					PLAYWRIGHT_BASE_URL: playwrightBaseUrl,
					NODE_OPTIONS: withNodeHeapLimit(process.env.NODE_OPTIONS),
				},
				inheritedEnvironment: process.env,
				passthroughKeys: [
					"BLENDCALC_ALLOW_RESOURCE_PRESSURE",
					"PLAYWRIGHT_ENFORCE_DURATION_BUDGETS",
					"PLAYWRIGHT_EXHAUSTIVE_MATRIX",
					"PLAYWRIGHT_PROGRESS_REPORTER",
					"PLAYWRIGHT_SKIP_WEB_SERVER",
					"PLAYWRIGHT_WORKERS",
				],
			});
			exitCode = runCommand(
				"playwright",
				["test", ...playwrightArguments],
				environment,
			);
		}
	} finally {
		try {
			stopLocalSupabase({
				cwd: repositoryRoot,
				workdir: "infrastructure/blendCalcAPI",
			});
		} catch (error) {
			console.error(error instanceof Error ? error.message : error);
			if (exitCode === 0) exitCode = 1;
		}
		const cleanupExitCode = runCommand(
			"node",
			["scripts/operations/database/manage_test_database.mjs", "stop"],
			preparationEnvironment,
		);
		if (exitCode === 0 && cleanupExitCode !== 0) exitCode = cleanupExitCode;
	}
	process.exitCode = exitCode;
};

const isMainModule = process.argv[1]
	? fileURLToPath(import.meta.url) === resolve(process.argv[1])
	: false;

if (isMainModule) main();
