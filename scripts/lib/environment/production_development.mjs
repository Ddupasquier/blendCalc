/**
 * Purpose: Build the explicit production-connected environment used by the 5173
 * development server without restoring ambient Vite dotenv loading.
 */

import { realpathSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { createCleanProcessEnvironment } from "./runtime_environment.mjs";

export const productionDevelopmentEnvironmentKeys = Object.freeze([
	"PUBLIC_SITE_URL",
	"PUBLIC_SUPABASE_URL",
	"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
	"PUBLIC_TURNSTILE_SITE_KEY",
	"SUPABASE_SERVICE_ROLE_KEY",
	"BLENDCALC_API_SUPABASE_URL",
	"BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY",
	"BLENDCALC_API_READ_MODE",
	"FDC_API_KEY",
	"COLA_CLOUD_API_KEY",
	"FDA_RECALL_PROXY_SECRET",
	"CRON_SECRET",
	"RESEND_API_KEY",
]);

const requiredKeys = Object.freeze([
	"PUBLIC_SUPABASE_URL",
	"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
	"SUPABASE_SERVICE_ROLE_KEY",
	"BLENDCALC_API_SUPABASE_URL",
	"BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY",
	"BLENDCALC_API_READ_MODE",
]);

const expectedApplicationSupabaseHost = "wbqsnipoiqjzppjuawpn.supabase.co";
const expectedBlendCalcAPISupabaseHost = "smmiqvjctelnuzxbzdar.supabase.co";

const assertExactHttpsHost = (label, value, expectedHost) => {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${label} must be a valid URL.`);
	}
	if (url.protocol !== "https:" || url.host !== expectedHost) {
		throw new Error(
			`${label} must target the established BlendCalc production project.`,
		);
	}
};

export const readProductionDevelopmentEnvironment = ({
	repositoryRoot = process.cwd(),
	path = ".env",
} = {}) => {
	const environmentPath = resolve(repositoryRoot, path);
	let resolvedPath;
	try {
		resolvedPath = realpathSync(environmentPath);
	} catch {
		throw new Error(
			"Production-connected development requires the ignored repository-root `.env`. See `config/environments/production-development.example.env`.",
		);
	}
	const file = statSync(resolvedPath);
	if (!file.isFile() || (file.mode & 0o077) !== 0) {
		throw new Error(
			"Production-connected development requires `.env` to be an owner-only regular file (mode 600).",
		);
	}

	const parsed = parse(readFileSync(resolvedPath));
	const unexpectedKeys = Object.keys(parsed).filter(
		(key) => !productionDevelopmentEnvironmentKeys.includes(key),
	);
	if (unexpectedKeys.length > 0) {
		throw new Error(
			"Production-connected `.env` contains keys outside its reviewed allowlist.",
		);
	}
	for (const key of requiredKeys) {
		if (!parsed[key]?.trim()) {
			throw new Error(`Production-connected .env is missing ${key}.`);
		}
	}
	if (parsed.BLENDCALC_API_READ_MODE !== "isolated") {
		throw new Error(
			"Production-connected development requires BLENDCALC_API_READ_MODE=isolated.",
		);
	}
	assertExactHttpsHost(
		"PUBLIC_SUPABASE_URL",
		parsed.PUBLIC_SUPABASE_URL,
		expectedApplicationSupabaseHost,
	);
	assertExactHttpsHost(
		"BLENDCALC_API_SUPABASE_URL",
		parsed.BLENDCALC_API_SUPABASE_URL,
		expectedBlendCalcAPISupabaseHost,
	);

	const allowlisted = Object.fromEntries(
		productionDevelopmentEnvironmentKeys
			.filter((key) => key !== "PUBLIC_SITE_URL")
			.map((key) => [key, parsed[key] ?? ""]),
	);
	return createCleanProcessEnvironment({
		overrides: {
			...allowlisted,
			BLENDCALC_RUNTIME_ENVIRONMENT: "production",
			PUBLIC_SITE_URL: "http://localhost:5173",
		},
		passthroughKeys: ["BLENDCALC_ALLOW_RESOURCE_PRESSURE"],
	});
};
