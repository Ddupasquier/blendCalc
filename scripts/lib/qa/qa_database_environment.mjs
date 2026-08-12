/**
 * Purpose: Load the database credentials used by disposable QA fixture scripts and
 * reject a test-mode configuration that points outside localhost. This shared helper
 * Do not run directly; this helper is used by the catalog moderation fixture workflows.
 */

import { config } from "dotenv";

const isLocalHostname = (hostname) =>
	hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";

export const loadQaDatabaseEnvironment = () => {
	const testMode = process.env.BLENDCALC_DATABASE_ENVIRONMENT === "test";

	if (testMode) {
		config({ path: ".env.test.local", override: true, quiet: true });
	} else {
		config({ path: ".env", quiet: true });
		config({ path: ".env.moderation.local", override: true, quiet: true });
	}

	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(
			testMode
				? "Run npm run db:test:start to create .env.test.local before using QA fixture commands."
				: "Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
		);
	}

	if (testMode && !isLocalHostname(new URL(supabaseUrl).hostname)) {
		throw new Error(
			`Refusing to run a disposable QA fixture command against non-local Supabase URL ${supabaseUrl}.`,
		);
	}

	return { serviceRoleKey, supabaseUrl, testMode };
};
