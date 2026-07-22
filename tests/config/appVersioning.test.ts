import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	APP_BUILD_VERSION,
	APP_MAJOR_VERSION,
	APP_VERSION,
	APP_VERSION_LABEL,
} from "$lib/config/version";
import { BLENDCALC_API_V1 } from "$lib/api/v1/types";

const packageMetadata = JSON.parse(readFileSync("package.json", "utf8")) as {
	version: string;
};
const appLayout = readFileSync("src/routes/+layout.svelte", "utf8");
const serverHook = readFileSync("src/hooks.server.ts", "utf8");

describe("blendCalc versioning", () => {
	it("starts the MVP at application V1", () => {
		expect(packageMetadata.version).toBe("1.0.0");
		expect(APP_VERSION).toBe(packageMetadata.version);
		expect(APP_MAJOR_VERSION).toBe(1);
		expect(APP_VERSION_LABEL).toBe("V1");
		expect(APP_BUILD_VERSION).toMatch(/^1\.0\.0\+/);
	});

	it("keeps the API contract version independent", () => {
		expect(BLENDCALC_API_V1).toBe("1.0");
		expect(BLENDCALC_API_V1).not.toBe(APP_VERSION);
	});

	it("exposes app release and build identity globally", () => {
		expect(appLayout).toContain('name="application-version"');
		expect(appLayout).toContain('name="application-build"');
		expect(serverHook).toContain('"x-blendcalc-app-version"');
		expect(serverHook).toContain('"x-blendcalc-app-build"');
	});

	it("does not leave literal product versions in outbound scripts", () => {
		const scriptFiles = [
			"scripts/audits/audit_openfoodfacts_allergen_fields.mjs",
			"scripts/backfills/backfill_food_images.mjs",
			"scripts/backfills/backfill_shared_product_categories.mjs",
			"scripts/audits/benchmark_product_sources.mjs",
			"scripts/generators/generate_api_structures.mjs",
			"scripts/seeds/seed_custom_food_categories.mjs",
			"scripts/seeds/seed_food_preference_api_observations.mjs",
			"scripts/seeds/seed_manual_entry_nutrients.mjs",
		];
		for (const file of scriptFiles) {
			expect(readFileSync(file, "utf8")).not.toMatch(/blendCalc\/\d+\.\d+/);
		}
	});
});
