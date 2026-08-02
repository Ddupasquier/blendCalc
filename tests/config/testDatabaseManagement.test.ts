import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasValidGtinCheckDigit } from "$lib/utils/barcode/barcode";
import {
	getLocalQaCatalogBarcodes,
	localQaPersonas,
	localQaUsdaCatalogBarcodes,
} from "../../scripts/lib/local_qa_personas.mjs";

const script = readFileSync(
	"scripts/operations/manage_test_database.mjs",
	"utf8",
);
const tutorialUtility = readFileSync(
	"src/lib/utils/tutorial/tutorial.ts",
	"utf8",
);
const personas = readFileSync("scripts/lib/local_qa_personas.mjs", "utf8");

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

	it("seeds completed and pending tutorial personas with the current version", () => {
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
		expect(script).toContain("seedTestAccountState");
		expect(script).toContain("do_not_show_again: true");
		expect(script).toContain("completed_at: tutorialCompletedAt");
		expect(script).toContain('account.tutorialState === "pending"');
		expect(personas).toContain('email: "qa-onboarding@blendcalc.local"');
	});

	it("seeds purpose-built personas across the major application states", () => {
		expect(personas).toContain('email: "qa-user@blendcalc.local"');
		expect(personas).toContain('email: "qa-preferences@blendcalc.local"');
		expect(personas).toContain('email: "qa-empty@blendcalc.local"');
		expect(personas).toContain('email: "qa-onboarding@blendcalc.local"');
		expect(personas).toContain('email: "qa-moderator@blendcalc.local"');
		expect(personas).toContain('email: "qa-admin@blendcalc.local"');
		expect(personas).toContain('name: "QA Morning Green"');
		expect(personas).toContain('name: "QA Berry Repeat"');
		expect(personas).toContain('name: "QA Export Berry Mix"');
	});

	it("seeds useful list, Saved, Mix, preference, and moderation state", () => {
		expect(script).toContain("loadTestCatalogFoods");
		expect(script).toContain("seedTestFoodLists");
		expect(script).toContain('userClient.rpc("place_user_food_list_items"');
		expect(script).toContain("seedTestSavedDrinks");
		expect(script).toContain('userClient.rpc("save_saved_drink"');
		expect(script).toContain("seedTestMixPreferences");
		expect(script).toContain('userClient.rpc("save_mix_preferences"');
		expect(script).toContain("seedTestFoodPreferences");
		expect(script).toContain("seedModerationFixtures");
		expect(script).toContain("QA Reviewable Pantry Crisps");
		expect(script).toContain("QA Missing Evidence Pantry Crisps");
	});

	it("loads a broad catalog into the populated QA persona", () => {
		const populatedPersona = localQaPersonas.find(({ key }) => key === "user");
		const populatedBarcodes = new Set([
			...(populatedPersona?.lists.fridge ?? []),
			...(populatedPersona?.lists.shopping ?? []),
		]);

		expect(localQaUsdaCatalogBarcodes).toHaveLength(83);
		expect(new Set(localQaUsdaCatalogBarcodes)).toHaveLength(83);
		expect(populatedBarcodes).toHaveLength(100);
		expect(populatedPersona?.lists.fridge).toHaveLength(60);
		expect(populatedPersona?.lists.shopping).toHaveLength(40);
		expect(getLocalQaCatalogBarcodes()).toHaveLength(102);
	});

	it("uses valid GTINs for every USDA barcode fixture", () => {
		expect(localQaUsdaCatalogBarcodes.every(hasValidGtinCheckDigit)).toBe(true);
	});
});
