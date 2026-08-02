import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync("supabase/seed.sql", "utf8");

describe("local QA reference seed", () => {
	it("hydrates the DB-driven manual-entry catalogs", () => {
		expect(seed).toContain("public.nutrient_manual_entry_groups");
		expect(seed).toContain("public.nutrient_manual_entry_fields");
		expect(seed).toContain("local-qa-reference-fixture-v1");
	});

	it("hydrates serving measures and searchable categories", () => {
		expect(seed).toContain("public.serving_measure_units");
		expect(seed).toContain("public.serving_measure_aliases");
		expect(seed).toContain("public.custom_food_category_options");
		expect(seed).toContain("public.food_preference_option_catalog");
		expect(seed).toContain("'Nut & Seed Butters'");
		expect(seed).toContain("('jams', 'Jams', 'jams', 'spreads-preserves')");
	});

	it("includes a deterministic category catalog beyond the former row cutoff", () => {
		expect(seed).toContain("generate_series(1, 1005)");
		expect(seed).toContain("'qa-yogurts'");
		expect(seed).toContain("'Yogurts'");
		expect(seed).toContain("'local-qa-scale-fixture'");
	});

	it("provides publishable catalog products without live provider requests", () => {
		expect(seed).toContain("qa_catalog_product_fixtures");
		expect(seed).toContain("'00021130462506'");
		expect(seed).toContain("'00021130493609'");
		expect(seed).toContain("'08801005523455'");
		expect(seed).toContain("'00869759000149'");
		expect(seed).toContain("'00011110904416'");
		expect(seed).toContain("public.shared_product_field_provenance");
		expect(seed).toContain("public.food_nutrients");
		expect(seed).toContain("public.food_servings");
	});

	it("preserves mixed-source evidence for the pasta-sauce regression fixture", () => {
		expect(seed).toContain('"fdcId": 2032704');
		expect(seed).toContain("evidence_reference = '2032704'");
		expect(seed).toContain("evidence_source = 'usda'");
		expect(seed).toContain("evidence_license = 'CC0-1.0'");
		expect(seed).toContain('"reportedNutrientIds": [1253,1079,1092');
		expect(seed).toContain("'open-food-facts'");
	});

	it("provides broad generic-food fixtures for cross-view QA", () => {
		expect(seed).toContain("qa_generic_foods");
		expect(seed).toContain("'09000000000018'");
		expect(seed).toContain("'Spinach, Raw'");
		expect(seed).toContain("'Ground Beef, 85% Lean, Cooked'");
		expect(seed).toContain("'Shrimp, Cooked'");
		expect(seed).toContain("'Egg, Whole, Cooked'");
		expect(seed).toContain("'Lemon Juice, Raw'");
		expect(seed).toContain("'09000000000179'");
		expect(seed).toContain("'Tomatoes, Green, Raw'");
		expect(seed).toContain("'Babyfood, Ravioli, Cheese Filled, With Tomato Sauce'");
		expect(seed).toContain("'Babyfood, Dinner, Macaroni And Tomato'");
	});

	it("provides licensed image attribution without a live image-source request", () => {
		expect(seed).toContain("insert into public.food_image_assets");
		expect(seed).toContain("'https://world.openfoodfacts.org/product/0021130493609'");
		expect(seed).toContain("'CC BY-SA 3.0'");
		expect(seed).toContain("'Open Food Facts contributors'");
	});

	it("provides a broad real USDA catalog corpus with source attribution", () => {
		expect(seed).toContain("qa_usda_products");
		expect(seed).toContain("'00867824000001'");
		expect(seed).toContain("'00812624010613'");
		expect(seed).toContain("qa_valid_usda_replacements");
		expect(seed).toContain("'00852945006063'");
		expect(seed).toContain("where public.is_valid_gtin(barcode)");
		expect(seed).toContain("'CC0-1.0'");
		expect(seed).toContain("'exact-barcode'");
		expect(seed).toContain("USDA FoodData Central");
	});

	it("restores canonical validation rules after destructive QA", () => {
		expect(seed).toContain("update public.nutrient_relationship_rules");
		expect(seed).toContain("where source = 'nutrient_definitions'");
	});

	it("contains no users or private product records", () => {
		expect(seed).not.toContain("auth.users");
		expect(seed).not.toContain("public.profiles");
		expect(seed).not.toContain("public.custom_foods");
		expect(seed).not.toContain("public.product_submission_evidence");
	});
});
