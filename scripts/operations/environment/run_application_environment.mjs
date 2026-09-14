/**
 * Purpose: Start BlendCalc only against validated local application and blendCalcAPI
 * services with an allowlisted child environment.
 * Run: `npm run dev:local`, `npm run dev:test`, `npm run dev:test:auth`, or
 * `npm run dev:rehearsal`.
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

if (!new Set(["local", "test", "rehearsal"]).has(runtimeEnvironment)) {
	throw new Error(
		"Application launcher accepts only local, test, or rehearsal.",
	);
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

const readGeneratedRehearsalEnvironment = () => {
	const generated = parse(
		readFileSync(`${repositoryRoot}/.rehearsal/runtime.env`),
	);
	return {
		PUBLIC_SUPABASE_URL: generated.PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_PUBLISHABLE_KEY: generated.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		SUPABASE_SERVICE_ROLE_KEY: generated.SUPABASE_SERVICE_ROLE_KEY,
		BLENDCALC_REHEARSAL_ACCOUNT_EMAIL:
			generated.BLENDCALC_REHEARSAL_ACCOUNT_EMAIL,
		BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD:
			generated.BLENDCALC_REHEARSAL_ACCOUNT_PASSWORD,
	};
};

const startApplicationSupabase = () => {
	if (runtimeEnvironment === "rehearsal") {
		runPreparation("node", [
			"scripts/operations/database/manage_rehearsal_database.mjs",
			"start",
		]);
		const generated = readGeneratedRehearsalEnvironment();
		return {
			apiUrl: generated.PUBLIC_SUPABASE_URL,
			publishableKey: generated.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			serviceRoleKey: generated.SUPABASE_SERVICE_ROLE_KEY,
		};
	}
	if (runtimeEnvironment === "test") {
		runPreparation("node", [
			"scripts/operations/database/manage_test_database.mjs",
			"start",
		]);
		return readLocalSupabaseEnvironment({ cwd: repositoryRoot });
	}
	return startLocalSupabase({
		cwd: repositoryRoot,
		exclude: ["edge-runtime", "logflare", "vector"],
	});
};

const applicationSupabase = startApplicationSupabase();
const blendCalcAPISupabase = startLocalSupabase({
	cwd: repositoryRoot,
	workdir: blendCalcAPIWorkdir,
});
const port =
	runtimeEnvironment === "test"
		? 5174
		: runtimeEnvironment === "rehearsal"
			? 5175
			: 5173;
const generatedTestEnvironment =
	runtimeEnvironment === "test" ? readGeneratedTestEnvironment() : {};
const generatedRehearsalEnvironment =
	runtimeEnvironment === "rehearsal" ? readGeneratedRehearsalEnvironment() : {};
const environment = createSafeLocalApplicationEnvironment({
	runtimeEnvironment,
	applicationUrl: `http://localhost:${port}`,
	applicationSupabase,
	blendCalcAPISupabase,
	additionalEnvironment: {
		...generatedTestEnvironment,
		...generatedRehearsalEnvironment,
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
	`Starting BlendCalc ${runtimeEnvironment.toUpperCase()} on localhost:${port} with local application and API databases. Provider-data and hosted side effects are disabled${runtimeEnvironment === "rehearsal" ? "; configured external identity returns only to local Auth" : ""}.`,
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
