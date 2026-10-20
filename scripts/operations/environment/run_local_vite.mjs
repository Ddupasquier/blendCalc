/**
 * Purpose: Launch local Vite dev/preview with a bounded 64 KiB HTTP-header budget.
 * Run: `node scripts/operations/environment/run_local_vite.mjs dev|preview [Vite args]`.
 * Preserves the caller's environment and working directory; does not load credentials
 * or start databases. Production deployment processes do not use this launcher.
 */

import { spawn } from "node:child_process";
import { constants } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LOCAL_HTTP_HEADER_BYTES = 64 * 1024;
const viteEntry = fileURLToPath(
	new URL("../../../node_modules/vite/bin/vite.js", import.meta.url),
);

export const localViteNodeArguments = (args) => {
	if (!["dev", "preview"].includes(args[0])) {
		throw new Error("The local Vite launcher accepts only dev or preview.");
	}
	return [
		`--max-http-header-size=${LOCAL_HTTP_HEADER_BYTES}`,
		viteEntry,
		...args,
	];
};

export const main = (args = process.argv.slice(2)) => {
	const child = spawn(process.execPath, localViteNodeArguments(args), {
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	});
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.on(signal, () => child.kill(signal));
	}
	child.on("error", (error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
	child.on("exit", (code, signal) => {
		process.exitCode = signal ? 128 + constants.signals[signal] : (code ?? 1);
	});
	return child;
};

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main();
}
