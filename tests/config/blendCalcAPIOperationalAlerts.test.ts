import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("blendCalcAPI operational alert architecture", () => {
	it("schedules the protected alert route without exposing email secrets", () => {
		const workflow = read(".github/workflows/blendcalc-api-alerts.yml");
		expect(workflow).toContain('cron: "7,22,37,52 * * * *"');
		expect(workflow).toContain("vars.BLENDCALC_API_ALERT_URL");
		expect(workflow).toContain("secrets.CRON_SECRET");
		expect(workflow).not.toContain("RESEND_API_KEY");
		expect(workflow).not.toContain("API_ALERT_EMAIL_TO");
	});

	it("keeps alert credentials server-only and documented", () => {
		const environment = read("docs/development/environment.md");
		for (const name of [
			"API_ALERT_EMAIL_FROM",
			"API_ALERT_EMAIL_TO",
			"BLENDCALC_API_ALERT_URL",
		]) {
			expect(environment).toContain(name);
		}
		expect(read(".env.vercel.example")).toContain("API_ALERT_EMAIL_TO=");
	});

	it("keeps key anomaly evidence aggregate and service-only", () => {
		const migration = read(
			"infrastructure/blendCalcAPI/supabase/migrations/20260908233000_add_operational_alert_metrics.sql",
		);
		expect(migration).toContain("api_key_usage_operations_dashboard");
		expect(migration).toContain("max_requests_per_key");
		expect(migration).toContain("from public, anon, authenticated");
		expect(migration).not.toContain("select\n\twindow_name,\n\tactor_hash");
	});
});
