import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	"supabase/migrations/20260718181000_nutrition_label_ocr_mappings.sql",
	"utf8",
);

describe("nutrition label OCR mappings migration", () => {
	it("keeps label aliases in database reference rows", () => {
		for (const alias of [
			"calories",
			"total fat",
			"sodium",
			"total carbohydrate",
			"dietary fiber",
			"added sugars",
			"vitamin d",
		]) {
			expect(migration).toContain(`'${alias}'`);
		}
		expect(migration).toContain("public.nutrient_source_mappings");
	});

	it("requires confirmation and preserves label ownership", () => {
		expect(migration).toContain("'requires_user_confirmation', true");
		expect(migration).toContain("'output_source_key', 'user-label'");
	});

	it("provides the nutrient-specific vitamin D conversion", () => {
		expect(migration).toContain("'IU'");
		expect(migration).toContain("'UG'");
		expect(migration).toContain("0.025");
	});
});
