/**
 * Purpose: Prepare, run, and always clean up a bounded Playwright verification pass.
 * Run: `npm run test:e2e` or another maintained `test:e2e*` npm command.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
	const environment = {
		...process.env,
		NODE_OPTIONS: withNodeHeapLimit(process.env.NODE_OPTIONS),
	};
	let exitCode = runCommand("npm", ["run", "test:e2e:prepare"], environment);
	try {
		if (exitCode === 0) {
			exitCode = runCommand(
				"playwright",
				["test", ...playwrightArguments],
				environment,
			);
		}
	} finally {
		const cleanupExitCode = runCommand(
			"node",
			["scripts/operations/database/manage_test_database.mjs", "stop"],
			environment,
		);
		if (exitCode === 0 && cleanupExitCode !== 0) exitCode = cleanupExitCode;
	}
	process.exitCode = exitCode;
};

const isMainModule = process.argv[1]
	? fileURLToPath(import.meta.url) === resolve(process.argv[1])
	: false;

if (isMainModule) main();
