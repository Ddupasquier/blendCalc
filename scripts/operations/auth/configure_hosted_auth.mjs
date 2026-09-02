/**
 * Purpose: Apply explicitly requested Turnstile or custom SMTP settings to the
 * linked hosted Supabase Auth service without printing protected values.
 * Run: `npm run auth:configure-hosted -- --turnstile`, then repeat with the
 * reported `--confirm-project=<project-ref>` only after reviewing the dry run.
 * Writes: Only the named hosted Auth settings; never Git or local environment files.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

const CONFIGURATION_VARIABLES = {
	turnstile: ["SUPABASE_AUTH_TURNSTILE_SECRET"],
	smtp: [
		"SUPABASE_AUTH_SMTP_ADMIN_EMAIL",
		"SUPABASE_AUTH_SMTP_HOST",
		"SUPABASE_AUTH_SMTP_PORT",
		"SUPABASE_AUTH_SMTP_USER",
		"SUPABASE_AUTH_SMTP_PASS",
		"SUPABASE_AUTH_SMTP_SENDER_NAME",
	],
};
const PROJECT_CONFIRMATION_PREFIX = "--confirm-project=";
const allowedArguments = new Set(["--turnstile", "--smtp", "--dry-run"]);

const readRequiredValues = (environment, names) => {
	const values = Object.fromEntries(
		names.map((name) => [name, String(environment[name] ?? "").trim()]),
	);
	const missingNames = names.filter((name) => !values[name]);
	if (missingNames.length > 0) {
		throw new Error(`Missing required variables: ${missingNames.join(", ")}.`);
	}
	return values;
};

export const buildHostedAuthPatch = (
	environment,
	{ turnstile = false, smtp = false } = {},
) => {
	if (!turnstile && !smtp) {
		throw new Error("Choose --turnstile, --smtp, or both.");
	}

	const patch = {};
	if (turnstile) {
		const values = readRequiredValues(
			environment,
			CONFIGURATION_VARIABLES.turnstile,
		);
		Object.assign(patch, {
			security_captcha_enabled: true,
			security_captcha_provider: "turnstile",
			security_captcha_secret: values.SUPABASE_AUTH_TURNSTILE_SECRET,
		});
	}

	if (smtp) {
		const values = readRequiredValues(
			environment,
			CONFIGURATION_VARIABLES.smtp,
		);
		Object.assign(patch, {
			smtp_admin_email: values.SUPABASE_AUTH_SMTP_ADMIN_EMAIL,
			smtp_host: values.SUPABASE_AUTH_SMTP_HOST,
			smtp_port: values.SUPABASE_AUTH_SMTP_PORT,
			smtp_user: values.SUPABASE_AUTH_SMTP_USER,
			smtp_pass: values.SUPABASE_AUTH_SMTP_PASS,
			smtp_sender_name: values.SUPABASE_AUTH_SMTP_SENDER_NAME,
		});
	}

	return patch;
};

export const summarizeHostedAuthConfiguration = (
	authConfiguration,
	{ turnstile = false, smtp = false } = {},
	expectedPatch = {},
) => ({
	...(turnstile
		? {
				turnstileConfigured:
					authConfiguration?.security_captcha_enabled === true &&
					authConfiguration?.security_captcha_provider === "turnstile" &&
					authConfiguration?.security_captcha_secret ===
						expectedPatch.security_captcha_secret,
			}
		: {}),
	...(smtp
		? {
				customSmtpConfigured: [
					"smtp_admin_email",
					"smtp_host",
					"smtp_port",
					"smtp_user",
					"smtp_pass",
					"smtp_sender_name",
				].every(
					(field) =>
						String(authConfiguration?.[field] ?? "") ===
						String(expectedPatch[field] ?? ""),
				),
			}
		: {}),
});

export const assertHostedAuthProjectConfirmation = ({
	projectReference,
	confirmation,
	dryRun = false,
}) => {
	if (dryRun) return;
	if (confirmation !== projectReference) {
		throw new Error(
			`Refusing hosted Auth write. Run the dry run, then pass --confirm-project=${projectReference}.`,
		);
	}
};

const readProjectReference = (environment) => {
	const environmentReference = environment.SUPABASE_PROJECT_ID?.trim();
	if (environmentReference) return environmentReference;
	return readFileSync(resolve("supabase/.temp/project-ref"), "utf8").trim();
};

const readSupabaseAccessToken = (environment) => {
	const environmentToken = environment.SUPABASE_ACCESS_TOKEN?.trim();
	if (environmentToken) return environmentToken;
	if (process.platform !== "darwin") {
		throw new Error(
			"SUPABASE_ACCESS_TOKEN is required outside macOS; keep it only in the protected environment.",
		);
	}
	return execFileSync(
		"security",
		["find-generic-password", "-s", "Supabase CLI", "-w"],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
	).trim();
};

const updateHostedAuth = async ({ projectReference, accessToken, patch }) => {
	const response = await fetch(
		`https://api.supabase.com/v1/projects/${projectReference}/config/auth`,
		{
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(patch),
			signal: AbortSignal.timeout(30_000),
		},
	);
	if (!response.ok) {
		throw new Error(
			`Unable to update hosted Auth configuration (HTTP ${response.status}).`,
		);
	}
	return response.json();
};

const run = async () => {
	const loadedEnvironment = config({
		path: ".env.moderation.local",
		quiet: true,
		processEnv: {},
	});
	if (loadedEnvironment.error) {
		throw new Error("Unable to read the protected .env.moderation.local file.");
	}
	const privilegedEnvironment = loadedEnvironment.parsed ?? {};
	const rawArguments = process.argv.slice(2);
	const unknownArguments = rawArguments.filter(
		(argument) =>
			!allowedArguments.has(argument) &&
			!argument.startsWith(PROJECT_CONFIRMATION_PREFIX),
	);
	if (unknownArguments.length > 0) {
		throw new Error(`Unsupported arguments: ${unknownArguments.join(", ")}.`);
	}
	const argumentsSet = new Set(rawArguments);
	const operations = {
		turnstile: argumentsSet.has("--turnstile"),
		smtp: argumentsSet.has("--smtp"),
	};
	const patch = buildHostedAuthPatch(privilegedEnvironment, operations);
	const requestedNames = Object.entries(operations)
		.filter(([, requested]) => requested)
		.map(([name]) => name);
	const projectReference = readProjectReference(privilegedEnvironment);
	const projectConfirmationArguments = rawArguments.filter((argument) =>
		argument.startsWith(PROJECT_CONFIRMATION_PREFIX),
	);
	if (projectConfirmationArguments.length > 1) {
		throw new Error("Provide exactly one --confirm-project value.");
	}
	const projectConfirmation = projectConfirmationArguments[0]?.slice(
		PROJECT_CONFIRMATION_PREFIX.length,
	);
	const dryRun = argumentsSet.has("--dry-run");
	assertHostedAuthProjectConfirmation({
		projectReference,
		confirmation: projectConfirmation,
		dryRun,
	});

	if (dryRun) {
		console.log(
			`Hosted Auth configuration is ready for project ${projectReference}: ${requestedNames.join(", ")}. Repeat with --confirm-project=${projectReference} to apply.`,
		);
		return;
	}

	const authConfiguration = await updateHostedAuth({
		projectReference,
		accessToken: readSupabaseAccessToken(privilegedEnvironment),
		patch,
	});
	const summary = summarizeHostedAuthConfiguration(
		authConfiguration,
		operations,
		patch,
	);
	if (Object.values(summary).some((configured) => configured !== true)) {
		throw new Error(
			`Hosted Auth did not confirm: ${requestedNames.join(", ")}.`,
		);
	}
	console.log(
		`Hosted Auth configuration confirmed: ${requestedNames.join(", ")}.`,
	);
};

const isDirectExecution =
	process.argv[1] &&
	pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
	run().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
