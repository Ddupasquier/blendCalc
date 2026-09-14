import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
	assertSafeLocalApplicationEnvironment,
	createCleanProcessEnvironment,
	createSafeLocalApplicationEnvironment,
} from "../../scripts/lib/environment/runtime_environment.mjs";
import {
	parseSupabaseStatusEnvironment,
	removeLocalSupabaseProjectResources,
} from "../../scripts/lib/environment/local_supabase.mjs";

const applicationSupabase = {
	apiUrl: "http://127.0.0.1:54321",
	publishableKey: "local-publishable",
	serviceRoleKey: "local-service-role",
};
const blendCalcAPISupabase = {
	apiUrl: "http://127.0.0.1:55321",
	publishableKey: "api-local-publishable",
	serviceRoleKey: "api-local-service-role",
};

describe("script runtime environments", () => {
	it("refuses broad or malformed Docker cleanup targets before invoking Docker", () => {
		for (const projectId of [
			undefined,
			"",
			"*",
			"../project",
			"Production DB",
		]) {
			expect(() => removeLocalSupabaseProjectResources({ projectId })).toThrow(
				"exact safe project id",
			);
		}
	});

	it("drops ambient credentials and keeps only explicitly approved process values", () => {
		const environment = createCleanProcessEnvironment({
			inheritedEnvironment: {
				HOME: "/safe/home",
				PATH: "/safe/bin",
				RESEND_API_KEY: "must-not-survive",
				SUPABASE_ACCESS_TOKEN: "must-not-survive",
				PLAYWRIGHT_WORKERS: "2",
			},
			passthroughKeys: ["PLAYWRIGHT_WORKERS"],
		});
		expect(environment).toEqual({
			HOME: "/safe/home",
			PATH: "/safe/bin",
			PLAYWRIGHT_WORKERS: "2",
		});
	});

	it("constructs an isolated local application environment", () => {
		const environment = createSafeLocalApplicationEnvironment({
			runtimeEnvironment: "test",
			applicationUrl: "http://localhost:5174",
			applicationSupabase,
			blendCalcAPISupabase,
			inheritedEnvironment: {
				PATH: "/safe/bin",
				FDC_API_KEY: "must-not-survive",
			},
		});
		expect(environment).toMatchObject({
			BLENDCALC_DISABLE_VITE_ENV_FILES: "true",
			BLENDCALC_RUNTIME_ENVIRONMENT: "test",
			BLENDCALC_API_READ_MODE: "isolated",
			PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
			BLENDCALC_API_SUPABASE_URL: "http://127.0.0.1:55321",
		});
		expect(environment).not.toHaveProperty("FDC_API_KEY");
	});

	it("does not allow caller additions to replace its local runtime boundary", () => {
		const environment = createSafeLocalApplicationEnvironment({
			runtimeEnvironment: "test",
			applicationUrl: "http://localhost:5174",
			applicationSupabase,
			blendCalcAPISupabase,
			additionalEnvironment: {
				BLENDCALC_RUNTIME_ENVIRONMENT: "production",
				PUBLIC_SUPABASE_URL: "https://example.supabase.co",
				BLENDCALC_API_READ_MODE: "source",
			},
		});
		expect(environment).toMatchObject({
			BLENDCALC_RUNTIME_ENVIRONMENT: "test",
			PUBLIC_SUPABASE_URL: applicationSupabase.apiUrl,
			BLENDCALC_API_READ_MODE: "isolated",
		});
	});

	it("rejects hosted targets and side-effect credentials", () => {
		expect(() =>
			assertSafeLocalApplicationEnvironment({
				BLENDCALC_RUNTIME_ENVIRONMENT: "local",
				PUBLIC_SITE_URL: "http://localhost:5173",
				PUBLIC_SUPABASE_URL: "https://example.supabase.co",
				BLENDCALC_API_SUPABASE_URL: "http://127.0.0.1:55321",
				BLENDCALC_API_READ_MODE: "isolated",
			}),
		).toThrow("PUBLIC_SUPABASE_URL must use a loopback URL");
		expect(() =>
			assertSafeLocalApplicationEnvironment({
				BLENDCALC_RUNTIME_ENVIRONMENT: "local",
				PUBLIC_SITE_URL: "http://localhost:5173",
				PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
				BLENDCALC_API_SUPABASE_URL: "http://127.0.0.1:55321",
				BLENDCALC_API_READ_MODE: "isolated",
				RESEND_API_KEY: "forbidden",
			}),
		).toThrow("RESEND_API_KEY is forbidden");
	});

	it("parses quoted Supabase status values without exposing unrelated output", () => {
		expect(
			parseSupabaseStatusEnvironment(
				'API_URL="http://127.0.0.1:54321"\nANON_KEY="local-key"\nStopped services: [x]\n',
			),
		).toEqual({
			API_URL: "http://127.0.0.1:54321",
			ANON_KEY: "local-key",
		});
	});

	it("keeps Rehearsal on isolated ports with local TOTP enrollment enabled", () => {
		const config = readFileSync(
			"infrastructure/rehearsal/application/supabase/config.toml",
			"utf8",
		);
		expect(config).toContain('project_id = "blendcalc-rehearsal"');
		expect(config).toContain("port = 58321");
		expect(config).toContain("port = 58322");
		expect(config).toContain('site_url = "http://localhost:5175"');
		expect(config).toContain("[auth.hook.custom_access_token]");
		expect(config).toContain(
			'uri = "pg-functions://postgres/public/custom_access_token_hook"',
		);
		expect(config).toMatch(
			/\[auth\.mfa\.totp\][\s\S]*enroll_enabled = true[\s\S]*verify_enabled = true/u,
		);
		expect(config).toContain("enable_signup = true");
		expect(config).toMatch(
			/\[auth\.external\.google\][\s\S]*enabled = true[\s\S]*SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID[\s\S]*SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET/u,
		);
		expect(config).toContain(
			'redirect_uri = "http://127.0.0.1:58321/auth/v1/callback"',
		);
	});
});
