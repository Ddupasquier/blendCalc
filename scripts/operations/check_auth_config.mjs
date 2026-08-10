/**
 * Purpose: Validate authentication-related environment URLs and secrets before running
 * or deploying the app. It prints actionable failures/warnings and never writes data.
 * Run: `npm run check:auth`
 */

import "dotenv/config";

const failures = [];
const warnings = [];

const requireUrl = (name, { https = true } = {}) => {
	const value = process.env[name]?.trim();
	if (!value) {
		failures.push(`${name} is missing.`);
		return null;
	}

	try {
		const url = new URL(value);
		if (https && url.protocol !== "https:") {
			failures.push(`${name} must use https in hosted environments.`);
		}
		return url;
	} catch {
		failures.push(`${name} is not a valid URL.`);
		return null;
	}
};

const supabaseUrl = requireUrl("PUBLIC_SUPABASE_URL");
const siteUrlValue = process.env.PUBLIC_SITE_URL?.trim();
const siteUrl = siteUrlValue ? requireUrl("PUBLIC_SITE_URL") : null;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!publishableKey) failures.push("PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.");
if (!siteUrlValue) {
	warnings.push(
		"PUBLIC_SITE_URL is empty. That is valid locally, but production must set the canonical HTTPS origin.",
	);
}

if (supabaseUrl && publishableKey) {
	try {
		const response = await fetch(new URL("/auth/v1/health", supabaseUrl), {
			headers: { apikey: publishableKey },
		});
		if (!response.ok) {
			failures.push(`Supabase Auth health check returned HTTP ${response.status}.`);
		}
	} catch (error) {
		failures.push(`Supabase Auth health check failed: ${error.message}`);
	}
}

if (siteUrl) {
	try {
		const response = await fetch(siteUrl, { redirect: "manual" });
		if (response.status >= 500) {
			failures.push(`PUBLIC_SITE_URL returned HTTP ${response.status}.`);
		}
	} catch (error) {
		failures.push(`PUBLIC_SITE_URL could not be reached: ${error.message}`);
	}
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const failure of failures) console.error(`ERROR: ${failure}`);

if (failures.length > 0) process.exit(1);
console.log("Auth environment and reachable endpoints look valid.");
