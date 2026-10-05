/**
 * Purpose: Start BlendCalc only against validated TEST application and
 * blendCalcAPI services with an allowlisted child environment.
 * Run: `npm run dev:test` or `npm run dev:test:auth`.
 * This command never reads hosted credentials or contacts a hosted database.
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import {
	createCleanProcessEnvironment,
	createSafeLocalApplicationEnvironment,
} from "../../lib/environment/runtime_environment.mjs";
import {
	readLocalSupabaseEnvironment,
	startLocalSupabase,
} from "../../lib/environment/local_supabase.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const blendCalcAPIWorkdir = "infrastructure/blendCalcAPI";
const runtimeEnvironment = process.argv[2];
const useTurnstileTestWidget = process.argv.includes("--auth");

if (runtimeEnvironment !== "test") {
	throw new Error("The QA application launcher accepts only test.");
}

const runPreparation = (command, args) => {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		env: createCleanProcessEnvironment(),
		stdio: "inherit",
	});
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
};

const readGeneratedTestEnvironment = () =>
	parse(readFileSync(`${repositoryRoot}/.env.test.local`));

const startApplicationSupabase = () => {
	runPreparation("node", [
		"scripts/operations/database/manage_test_database.mjs",
		"start",
	]);
	return readLocalSupabaseEnvironment({ cwd: repositoryRoot });
};

const applicationSupabase = startApplicationSupabase();
const blendCalcAPISupabase = startLocalSupabase({
	cwd: repositoryRoot,
	workdir: blendCalcAPIWorkdir,
});
const port = 5174;
const generatedTestEnvironment = readGeneratedTestEnvironment();
const environment = createSafeLocalApplicationEnvironment({
	runtimeEnvironment,
	applicationUrl: `http://localhost:${port}`,
	applicationSupabase,
	blendCalcAPISupabase,
	additionalEnvironment: {
		...generatedTestEnvironment,
		BLENDCALC_RUNTIME_ENVIRONMENT: runtimeEnvironment,
		PUBLIC_SITE_URL: `http://localhost:${port}`,
		PUBLIC_SUPABASE_URL: applicationSupabase.apiUrl,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: applicationSupabase.publishableKey,
		SUPABASE_SERVICE_ROLE_KEY: applicationSupabase.serviceRoleKey,
		PUBLIC_TURNSTILE_SITE_KEY: useTurnstileTestWidget
			? "1x00000000000000000000AA"
			: "",
	},
	passthroughKeys: ["BLENDCALC_ALLOW_RESOURCE_PRESSURE"],
});

console.log(
	`Starting BlendCalc TEST on localhost:${port} with local application and API databases. Provider-data and hosted side effects are disabled.`,
);

const child = spawn(
	"vite",
	["dev", "--host", "localhost", "--port", String(port), "--strictPort"],
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
