import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/routes/+layout.svelte", "utf8");
const authAction = readFileSync("src/routes/auth/+page.server.ts", "utf8");
const authCallback = readFileSync(
	"src/routes/auth/callback/+server.ts",
	"utf8",
);
const logout = readFileSync("src/routes/auth/logout/+server.ts", "utf8");
const cronRoute = readFileSync(
	"src/routes/api/internal/analytics/sync/+server.ts",
	"utf8",
);
const publicationSyncWorkflow = readFileSync(
	".github/workflows/blendcalc-api-publication-sync.yml",
	"utf8",
);
const vercelConfiguration = JSON.parse(readFileSync("vercel.json", "utf8")) as {
	crons?: Array<{ path?: string; schedule?: string }>;
};

describe("app interaction analytics", () => {
	it("records only explicit successful auth boundaries", () => {
		expect(authAction).toContain("APP_INTERACTION_METRICS.LOGIN_SUCCESS");
		expect(authCallback).toContain("APP_INTERACTION_METRICS.LOGIN_SUCCESS");
		expect(logout).toContain("APP_INTERACTION_METRICS.LOGOUT_SUCCESS");
		expect(authAction).not.toContain("track(email");
		expect(authCallback).not.toContain("track(flowId");
		expect(logout).not.toContain("track(user");
	});

	it("records browser reloads without treating initial navigation as a reload", () => {
		expect(layout).toContain('navigationEntry?.type === "reload"');
		expect(layout).toContain("APP_INTERACTION_METRICS.PAGE_RELOAD");
		expect(layout).toContain(
			"if (dev || !isVercelObservabilityAvailable) return",
		);
	});

	it("protects and schedules the aggregate synchronization route", () => {
		expect(cronRoute).toContain("env.CRON_SECRET");
		expect(cronRoute).toContain(
			'request.headers.get("authorization") !== `Bearer ${cronSecret}`',
		);
		expect(vercelConfiguration.crons).toEqual([
			{
				path: "/api/internal/analytics/sync",
				schedule: "15 5 * * *",
			},
			{
				path: "/api/internal/blendCalcAPI/publication/sync",
				schedule: "30 5 * * *",
			},
		]);
		expect(publicationSyncWorkflow).toContain('cron: "*/15 * * * *"');
		expect(publicationSyncWorkflow).toContain(
			"CRON_SECRET: ${{ secrets.CRON_SECRET }}",
		);
		expect(publicationSyncWorkflow).toContain(
			"SYNC_URL: ${{ vars.BLENDCALC_API_SYNC_URL }}",
		);
		expect(publicationSyncWorkflow).toContain('test "$status_code" = "200"');
		expect(publicationSyncWorkflow).toContain(
			'.action == "created" or .action == "unchanged"',
		);
	});
});
