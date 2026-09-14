/**
 * Purpose: Build fail-closed child-process environments for local BlendCalc
 * development and verification. Do not run directly; this module is reusable script
 * infrastructure.
 */

import {
	assertLoopbackUrl,
	createCleanProcessEnvironment,
} from "../rehearsal/process_environment.mjs";

export {
	assertLoopbackUrl,
	createCleanProcessEnvironment,
	isLoopbackUrl,
	pickEnvironmentVariables,
} from "../rehearsal/process_environment.mjs";

export const BLENDCALC_RUNTIME_ENVIRONMENTS = Object.freeze([
	"local",
	"test",
	"rehearsal",
	"staging",
	"production",
]);

export const SAFE_LOCAL_RUNTIME_ENVIRONMENTS = Object.freeze([
	"local",
	"test",
	"rehearsal",
]);

const FORBIDDEN_LOCAL_SECRET_KEYS = Object.freeze([
	"API_ALERT_EMAIL_TO",
	"CATALOG_MONITOR_CRON_SECRET",
	"COLA_CLOUD_API_KEY",
	"CRON_SECRET",
	"FDA_RECALL_PROXY_PROTECTION_BYPASS_SECRET",
	"FDA_RECALL_PROXY_SECRET",
	"FDC_API_KEY",
	"OPENFDA_API_KEY",
	"RESEND_API_KEY",
	"SUPABASE_ACCESS_TOKEN",
	"SUPABASE_AUTH_SMTP_PASS",
	"SUPABASE_AUTH_TURNSTILE_SECRET",
	"SUPABASE_DB_PASSWORD",
	"SUPABASE_PROJECT_ID",
	"USDA_API_KEY",
	"VERCEL_ANALYTICS_ACCESS_TOKEN",
]);

export const isBlendCalcRuntimeEnvironment = (value) =>
	typeof value === "string" && BLENDCALC_RUNTIME_ENVIRONMENTS.includes(value);

export const isSafeLocalRuntimeEnvironment = (value) =>
	SAFE_LOCAL_RUNTIME_ENVIRONMENTS.includes(value);

export const assertSafeLocalApplicationEnvironment = (environment) => {
	const runtimeEnvironment = environment.BLENDCALC_RUNTIME_ENVIRONMENT;
	if (!isSafeLocalRuntimeEnvironment(runtimeEnvironment)) {
		throw new Error(
			"A local application launcher requires an explicit local, test, or rehearsal runtime.",
		);
	}

	assertLoopbackUrl("PUBLIC_SITE_URL", environment.PUBLIC_SITE_URL);
	assertLoopbackUrl("PUBLIC_SUPABASE_URL", environment.PUBLIC_SUPABASE_URL);
	assertLoopbackUrl(
		"BLENDCALC_API_SUPABASE_URL",
		environment.BLENDCALC_API_SUPABASE_URL,
	);
	if (environment.BLENDCALC_API_READ_MODE !== "isolated") {
		throw new Error(
			"Safe local runtimes require BLENDCALC_API_READ_MODE=isolated.",
		);
	}

	for (const key of FORBIDDEN_LOCAL_SECRET_KEYS) {
		if (environment[key]?.trim()) {
			throw new Error(`${key} is forbidden in safe local runtimes.`);
		}
	}

	return environment;
};

export const createSafeLocalApplicationEnvironment = ({
	runtimeEnvironment,
	applicationUrl,
	applicationSupabase,
	blendCalcAPISupabase,
	additionalEnvironment = {},
	inheritedEnvironment = process.env,
	passthroughKeys = [],
}) => {
	const environment = createCleanProcessEnvironment({
		inheritedEnvironment,
		passthroughKeys,
		overrides: {
			...additionalEnvironment,
			BLENDCALC_DISABLE_VITE_ENV_FILES: "true",
			BLENDCALC_RUNTIME_ENVIRONMENT: runtimeEnvironment,
			PUBLIC_SITE_URL: applicationUrl,
			PUBLIC_SUPABASE_URL: applicationSupabase.apiUrl,
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: applicationSupabase.publishableKey,
			SUPABASE_SERVICE_ROLE_KEY: applicationSupabase.serviceRoleKey,
			BLENDCALC_API_SUPABASE_URL: blendCalcAPISupabase.apiUrl,
			BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY:
				blendCalcAPISupabase.serviceRoleKey,
			BLENDCALC_API_READ_MODE: "isolated",
			PUBLIC_TURNSTILE_SITE_KEY: "",
		},
	});

	return assertSafeLocalApplicationEnvironment(environment);
};
