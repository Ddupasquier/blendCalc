/**
 * Purpose: Run compile and unit-test commands in a clean TEST process that cannot
 * inherit hosted credentials or provider side-effect secrets from the invoking shell.
 * Run: `node scripts/operations/environment/run_test_command.mjs -- <command>`.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import {
	assertLoopbackUrl,
	createSafeLocalApplicationEnvironment,
	isLoopbackUrl,
} from "../../lib/environment/runtime_environment.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const generatedEnvironmentPath = resolve(repositoryRoot, ".env.test.local");
const localPlaceholder = "blendcalc-hermetic-test-placeholder";

const readGeneratedTestEnvironment = () => {
	if (!existsSync(generatedEnvironmentPath)) return {};
	const environment = parse(readFileSync(generatedEnvironmentPath));
	if (environment.PUBLIC_SUPABASE_URL) {
		assertLoopbackUrl(
			".env.test.local PUBLIC_SUPABASE_URL",
			environment.PUBLIC_SUPABASE_URL,
		);
	}
	return environment;
};

const readLocalBlendCalcAPIEnvironment = () => {
	const apiUrl = process.env.BLENDCALC_API_SUPABASE_URL;
	if (!apiUrl || !isLoopbackUrl(apiUrl)) {
		return {
			apiUrl: "http://127.0.0.1:55321",
			serviceRoleKey: localPlaceholder,
		};
	}
	return {
		apiUrl,
		serviceRoleKey:
			process.env.BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY ?? localPlaceholder,
	};
};

export const main = async (args = process.argv.slice(2)) => {
	const commandArguments = args[0] === "--" ? args.slice(1) : args;
	const [command, ...rest] = commandArguments;
	if (!command) {
		throw new Error("Provide a command for the hermetic TEST environment.");
	}

	const generatedEnvironment = readGeneratedTestEnvironment();
	const applicationSupabase = {
		apiUrl:
			generatedEnvironment.PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
		publishableKey:
			generatedEnvironment.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? localPlaceholder,
		serviceRoleKey:
			generatedEnvironment.SUPABASE_SERVICE_ROLE_KEY ?? localPlaceholder,
	};
	const environment = createSafeLocalApplicationEnvironment({
		runtimeEnvironment: "test",
		applicationUrl: "http://localhost:5174",
		applicationSupabase,
		blendCalcAPISupabase: readLocalBlendCalcAPIEnvironment(),
		additionalEnvironment: generatedEnvironment,
		passthroughKeys: [
			"BLENDCALC_ALLOW_RESOURCE_PRESSURE",
			"FORMAT_BASE_REF",
			"NODE_OPTIONS",
			"TEST_BASE_REF",
		],
	});

	const exitCode = await new Promise((resolveExitCode) => {
		const child = spawn(command, rest, {
			cwd: repositoryRoot,
			env: environment,
			stdio: "inherit",
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
