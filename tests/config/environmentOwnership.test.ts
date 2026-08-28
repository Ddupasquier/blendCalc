import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readEnvironmentKeys = (path: string): string[] =>
	readFileSync(path, "utf8")
		.split("\n")
		.map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
		.filter((key): key is string => Boolean(key));

const expectedEnvironmentKeys = {
	".env.example": [
		"COLA_CLOUD_API_KEY",
		"FDC_API_KEY",
		"FDA_RECALL_PROXY_SECRET",
		"MODERATION_EMAIL_FROM",
		"MODERATION_SUPPORT_EMAIL",
		"PUBLIC_SITE_URL",
		"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		"PUBLIC_SUPABASE_URL",
		"PUBLIC_TURNSTILE_SITE_KEY",
		"RESEND_API_KEY",
		"SUPABASE_SERVICE_ROLE_KEY",
	],
	".env.moderation.example": [
		"COLA_CLOUD_API_KEY",
		"FDC_API_KEY",
		"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		"PUBLIC_SUPABASE_URL",
		"SUPABASE_ACCESS_TOKEN",
		"SUPABASE_DB_PASSWORD",
		"SUPABASE_PROJECT_ID",
		"SUPABASE_SERVICE_ROLE_KEY",
	],
	".env.test": [
		"BLENDCALC_DATABASE_ENVIRONMENT",
		"PUBLIC_SITE_URL",
		"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		"PUBLIC_SUPABASE_URL",
	],
	".env.vercel.example": [
		"COLA_CLOUD_API_KEY",
		"CRON_SECRET",
		"FDC_API_KEY",
		"FDA_RECALL_PROXY_SECRET",
		"MODERATION_EMAIL_FROM",
		"MODERATION_SUPPORT_EMAIL",
		"PUBLIC_SITE_URL",
		"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		"PUBLIC_SUPABASE_URL",
		"PUBLIC_TURNSTILE_SITE_KEY",
		"RESEND_API_KEY",
		"SUPABASE_SERVICE_ROLE_KEY",
		"VERCEL_ANALYTICS_ACCESS_TOKEN",
		"VERCEL_ANALYTICS_SYNC_LOOKBACK_DAYS",
		"VERCEL_TEAM_ID",
	],
	"supabase/functions/.env.example": [
		"CATALOG_MONITOR_CRON_SECRET",
		"FDA_RECALL_PROXY_PROTECTION_BYPASS_SECRET",
		"FDA_RECALL_PROXY_SECRET",
		"FDA_RECALL_PROXY_URL",
		"OPENFDA_API_KEY",
		"USDA_API_KEY",
	],
} as const;

describe("environment ownership", () => {
	it("keeps each tracked example limited to its documented consumer", () => {
		for (const [path, expectedKeys] of Object.entries(
			expectedEnvironmentKeys,
		)) {
			expect(readEnvironmentKeys(path).sort(), path).toEqual(
				[...expectedKeys].sort(),
			);
		}
	});

	it("keeps server credentials out of browser-safe naming", () => {
		for (const path of Object.keys(expectedEnvironmentKeys)) {
			for (const key of readEnvironmentKeys(path)) {
				if (!key.startsWith("PUBLIC_")) continue;
				expect(key, path).not.toMatch(
					/(?:API_KEY|SECRET|SERVICE_ROLE|PASSWORD|ACCESS_TOKEN)/,
				);
			}
		}
	});

	it("documents the environment split in the tracked guide and ignore rules", () => {
		const guide = readFileSync("docs/development/environment.md", "utf8");
		const gitignore = readFileSync(".gitignore", "utf8");

		for (const path of Object.keys(expectedEnvironmentKeys)) {
			expect(guide).toContain(`\`${path}\``);
		}
		expect(gitignore).toContain("!.env.vercel.example");
		expect(gitignore).toContain("!supabase/functions/.env.example");
	});
});
