import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readEnvironmentKeys = (path: string): string[] =>
	readFileSync(path, "utf8")
		.split("\n")
		.map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
		.filter((key): key is string => Boolean(key));

const readEnvironmentValue = (path: string, key: string) => {
	const line = readFileSync(path, "utf8")
		.split("\n")
		.find((candidate) => candidate.startsWith(`${key}=`));
	return line?.slice(key.length + 1).replace(/^"|"$/g, "") ?? null;
};

const listTrackedScriptFiles = (): string[] =>
	execFileSync("git", ["ls-files", "scripts"], { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter((path) => /\.(?:cjs|js|mjs|ts)$/.test(path));

const expectedEnvironmentKeys = {
	"config/environments/blendcalc-api-hosted.example.env": [
		"BLENDCALC_API_SUPABASE_DB_PASSWORD",
		"BLENDCALC_API_SUPABASE_PROJECT_ID",
	],
	"config/environments/rehearsal-auth.example.env": [
		"SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
		"SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET",
	],
	"config/environments/rehearsal-source.example.env": [
		"REHEARSAL_SOURCE_DATABASE_URL",
		"REHEARSAL_SOURCE_STORAGE_ACCESS_TOKEN",
		"REHEARSAL_SOURCE_STORAGE_PUBLISHABLE_KEY",
		"REHEARSAL_SOURCE_STORAGE_REFRESH_TOKEN",
		"REHEARSAL_SOURCE_STORAGE_URL",
	],
	"config/environments/privileged-operations.example.env": [
		"COLA_CLOUD_API_KEY",
		"FDC_API_KEY",
		"PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		"PUBLIC_SUPABASE_URL",
		"SUPABASE_ACCESS_TOKEN",
		"SUPABASE_AUTH_SMTP_ADMIN_EMAIL",
		"SUPABASE_AUTH_SMTP_HOST",
		"SUPABASE_AUTH_SMTP_PASS",
		"SUPABASE_AUTH_SMTP_PORT",
		"SUPABASE_AUTH_SMTP_SENDER_NAME",
		"SUPABASE_AUTH_SMTP_USER",
		"SUPABASE_AUTH_TURNSTILE_SECRET",
		"SUPABASE_DB_PASSWORD",
		"SUPABASE_PROJECT_ID",
		"SUPABASE_SERVICE_ROLE_KEY",
	],
	"config/environments/vercel.example.env": [
		"API_ALERT_EMAIL_FROM",
		"API_ALERT_EMAIL_TO",
		"BLENDCALC_API_READ_MODE",
		"BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY",
		"BLENDCALC_API_SUPABASE_URL",
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
		expect(gitignore).toContain(".env.*");
		expect(gitignore).toContain("!supabase/functions/.env.example");
	});

	it("keeps root dotenv files local and disables ambient Vite layering", () => {
		const viteConfiguration = readFileSync("vite.config.ts", "utf8");

		for (const removedContract of [
			".env.example",
			".env.test",
			".env.rehearsal",
			".env.moderation.example",
			".env.vercel.example",
		]) {
			expect(existsSync(removedContract), removedContract).toBe(false);
		}
		expect(viteConfiguration).toMatch(/envDir:\s*false/);
		expect(viteConfiguration).not.toContain("BLENDCALC_DISABLE_VITE_ENV_FILES");
	});

	it("prevents maintained scripts from loading ambient root dotenv files", () => {
		for (const path of listTrackedScriptFiles()) {
			const source = readFileSync(path, "utf8");
			expect(source, path).not.toMatch(/import\s+["']dotenv\/config["']/);
			expect(source, path).not.toMatch(
				/config\(\{\s*path:\s*["']\.env(?:\.local)?["']/,
			);
			expect(source, path).not.toMatch(
				/config\(\{\s*path:\s*path\.join\([^)]*,\s*["']\.env["']\)/,
			);
		}
	});

	it("keeps every tracked transactional sender on its purpose-specific identity", () => {
		for (const path of ["config/environments/vercel.example.env"]) {
			expect(readEnvironmentValue(path, "MODERATION_EMAIL_FROM"), path).toBe(
				"blendCalc <moderation@noreply.blendcalc.food>",
			);
			expect(readEnvironmentValue(path, "API_ALERT_EMAIL_FROM"), path).toBe(
				"blendCalc API <operations@noreply.blendcalc.food>",
			);
			expect(readEnvironmentValue(path, "MODERATION_SUPPORT_EMAIL"), path).toBe(
				"support@blendcalc.food",
			);
		}
		expect(
			readEnvironmentValue(
				"config/environments/privileged-operations.example.env",
				"SUPABASE_AUTH_SMTP_ADMIN_EMAIL",
			),
		).toBe("accounts@noreply.blendcalc.food");
	});
});
