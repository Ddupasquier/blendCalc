/**
 * Purpose: Refuse an unsafe local heavy run and bound the child Node heap without
 * modifying repository or machine state.
 * Run: `node scripts/operations/quality/run_with_resource_limits.mjs -- <command>`.
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalResourceSafety } from "../../lib/quality/resource_safety.mjs";

const nodeHeapLimitMegabytes = 4096;
const nodeHeapLimitPattern =
	/(?:^|\s)--max[-_]old[-_]space[-_]size(?:=|\s+)(\d+)(?=\s|$)/g;

export const withNodeHeapLimit = (nodeOptions = "") => {
	let effectiveExistingLimit = null;
	const optionsWithoutHeapLimits = nodeOptions.replace(
		nodeHeapLimitPattern,
		(_match, configuredLimit) => {
			effectiveExistingLimit = Number(configuredLimit);
			return " ";
		},
	);
	const boundedLimit = Math.min(
		effectiveExistingLimit ?? nodeHeapLimitMegabytes,
		nodeHeapLimitMegabytes,
	);
	return [
		optionsWithoutHeapLimits.trim().replace(/\s+/g, " "),
		`--max-old-space-size=${boundedLimit}`,
	]
		.filter(Boolean)
		.join(" ");
};

export const main = async (args = process.argv.slice(2)) => {
	const commandArgs = args[0] === "--" ? args.slice(1) : args;
	const [command, ...commandArguments] = commandArgs;
	if (!command) {
		throw new Error(
			"Provide a command after run_with_resource_limits.mjs, optionally separated by --.",
		);
	}
	assertLocalResourceSafety();
	const exitCode = await new Promise((resolveExitCode) => {
		const child = spawn(command, commandArguments, {
			stdio: "inherit",
			env: {
				...process.env,
				NODE_OPTIONS: withNodeHeapLimit(process.env.NODE_OPTIONS),
			},
		});
		child.on("error", (error) => {
			console.error(error.message);
			resolveExitCode(1);
		});
		child.on("close", (code, signal) => {
			resolveExitCode(signal ? 130 : (code ?? 1));
		});
	});
	process.exitCode = exitCode;
};

const isMainModule = process.argv[1]
	? fileURLToPath(import.meta.url) === resolve(process.argv[1])
	: false;

if (isMainModule) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
