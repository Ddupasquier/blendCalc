import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(
	"scripts/operations/manage_test_database.mjs",
	"utf8",
);
const tutorialUtility = readFileSync(
	"src/lib/utils/tutorial/tutorial.ts",
	"utf8",
);

describe("local test database management", () => {
	it("applies pending migrations before seeding QA accounts", () => {
		const migrationIndex = script.indexOf(
			'runCommand("supabase", ["migration", "up", "--local"])',
		);
		const seedIndex = script.indexOf(
			"if (seedAccounts) await seedTestAccounts(environment);",
		);

		expect(migrationIndex).toBeGreaterThan(-1);
		expect(seedIndex).toBeGreaterThan(migrationIndex);
	});

	it("applies deterministic reference fixtures during start and reset", () => {
		expect(script).toContain("applyLocalQaSeed");
		expect(script).toContain("Applying deterministic local QA reference fixtures");
		expect(script).toContain("supabase/seed.sql");
	});

	it("waits for both Auth and PostgREST before account seeding", () => {
		expect(script).toContain("waitForLocalServices");
		expect(script).toContain("admin.auth.admin.listUsers");
		expect(script).toContain('admin.from("profiles").select("user_id").limit(1)');
		expect(script).toContain("serviceReadinessAttempts");
	});

	it("refreshes the local gateway after reset before seeding accounts", () => {
		const resetIndex = script.indexOf(
			'runCommand("supabase", ["db", "reset", "--local"])',
		);
		const gatewayIndex = script.indexOf("await restartLocalGateway()", resetIndex);
		const seedIndex = script.indexOf(
			"await seedTestAccounts(environment)",
			gatewayIndex,
		);

		expect(resetIndex).toBeGreaterThan(-1);
		expect(gatewayIndex).toBeGreaterThan(resetIndex);
		expect(seedIndex).toBeGreaterThan(gatewayIndex);
	});

	it("keeps destructive database resets local", () => {
		expect(script).toContain(
			'runCommand("supabase", ["db", "reset", "--local"])',
		);
	});

	it("seeds standard QA accounts past onboarding with the current tutorial version", () => {
		const tutorialVersion = tutorialUtility.match(
			/export const CURRENT_TUTORIAL_VERSION = (\d+);/,
		)?.[1];

		expect(tutorialVersion).toBeTruthy();
		expect(script).toContain(
			`const currentTutorialVersion = ${tutorialVersion};`,
		);
		expect(script).toContain(
			'userClient.from("user_tutorial_preferences").upsert',
		);
		expect(script).toContain("seedTestTutorialPreference");
		expect(script).toContain("do_not_show_again: true");
		expect(script).toContain("completed_at: tutorialCompletedAt");
	});
});
