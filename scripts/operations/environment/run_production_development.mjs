/**
 * Purpose: Run localhost:5173 against BlendCalc's real hosted application and API
 * databases. Reads and writes are production reads and writes.
 * Run: `npm run dev` or `npm run dev:local`.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readProductionDevelopmentEnvironment } from "../../lib/environment/production_development.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const environment = readProductionDevelopmentEnvironment({ repositoryRoot });

if (process.argv.includes("--check")) {
	console.log(
		"Production-connected 5173 environment is configured for the established BlendCalc projects.",
	);
	process.exit(0);
}

console.warn(
	"Starting BlendCalc on localhost:5173 against REAL PRODUCTION data. Saves, edits, deletions, privileged actions, provider requests, and configured email side effects are real.",
);
console.warn(
	"Use Rehearsal on localhost:5175 for production-shaped work that must not affect production.",
);

const child = spawn(
	"vite",
	["dev", "--host", "localhost", "--port", "5173", "--strictPort"],
	{
		cwd: repositoryRoot,
		env: environment,
		stdio: "inherit",
	},
);

child.on("error", (error) => {
	console.error(error.message);
	process.exitCode = 1;
});
child.on("exit", (code, signal) => {
	if (signal) process.kill(process.pid, signal);
	else process.exit(code ?? 1);
});
