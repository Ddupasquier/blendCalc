/**
 * Purpose: Keep documentation preview, build and testing behind one npm command.
 * Run: `npm run docs -- [dev|build|test] [options]`; defaults to the local preview.
 * Starts only documentation tools; never starts app services or databases.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
if (Number(process.versions.node.split(".")[0]) !== 24)
	throw new Error("Documentation commands require Node.js 24.");
const args = process.argv.slice(2);
const usage =
	"Usage: npm run docs -- [dev|build|test] [options] (default: dev)";
if (args[0] === "--help") {
	console.log(usage);
} else {
	const mode =
		!args.length || args[0].startsWith("--") ? "dev" : (args.shift() ?? "dev");
	/** @type {Record<string, string[]>} */
	const commands = {
		dev: ["scripts/operations/documentation/preview_documentation.mjs"],
		build: ["scripts/generators/documentation/build_documentation.mjs"],
		test: [
			"scripts/operations/quality/run_with_resource_limits.mjs",
			process.execPath,
			"node_modules/@playwright/test/cli.js",
			"test",
			"--config",
			"config/documentation/playwright.config.ts",
		],
	};
	if (!Object.hasOwn(commands, mode)) {
		console.error(usage);
		process.exitCode = 2;
	} else {
		/** @param {string[]} commandArgs */
		const run = (commandArgs) => {
			const result = spawnSync(process.execPath, commandArgs, {
				cwd: repositoryRoot,
				stdio: "inherit",
			});
			return result.signal ? 130 : (result.status ?? 1);
		};
		const versionResult = run([
			"scripts/operations/releases/check_versions.mjs",
		]);
		process.exitCode = versionResult || run([...commands[mode], ...args]);
	}
}
