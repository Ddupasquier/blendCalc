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
		expect(seed).toContain("'05000159461122'");
		expect(seed).toContain("public.shared_product_field_provenance");
		expect(seed).toContain("public.food_nutrients");
		expect(seed).toContain("public.food_servings");
	});

	it("retains the exact packaged ingredient and allergen deep-dive corpus", () => {
		expect(seed).toContain('"brandOwner": "Sempio Foods Company"');
		expect(seed).toContain('"description": "Snickers"');
		expect(seed).toContain('"additives": ["E322","E322i"]');
		expect(seed).toContain('"allergens": ["eggs","milk","peanuts","soybeans"]');
		expect(seed).toContain('"traces": ["nuts"]');
		expect(seed).toContain('"precautionaryStatements": [{"type":"may_contain"');
		expect(seed).toContain("evidence_license = 'Open Database License 1.0'");
		expect(seed).toContain(
			"('structuredIngredients', fixture.food -> 'structuredIngredients'",
		);
		expect(seed).toContain("('additives', fixture.food -> 'additives'");
	});

	it("preserves mixed-source evidence for the pasta-sauce regression fixture", () => {
		expect(seed).toContain('"fdcId": 2032704');
		expect(seed).toContain("evidence_reference = '2032704'");
		expect(seed).toContain("evidence_source = 'usda'");
		expect(seed).toContain("evidence_license = 'CC0-1.0'");
		expect(seed).toContain('"reportedNutrientIds": [1253,1079,1092');
		expect(seed).toContain("'open-food-facts'");
	});

	it("provides source-backed package images for image-control role checks", () => {
		expect(seed).toContain(
			"https://images.openfoodfacts.org/images/products/002/113/049/3609/front_en.5.400.jpg",
		);
		expect(seed).toContain(
			"https://images.openfoodfacts.org/images/products/880/100/552/3455/front_en.6.400.jpg",
		);
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
		expect(seed).toContain(
			"'Babyfood, Ravioli, Cheese Filled, With Tomato Sauce'",
		);
		expect(seed).toContain("'Babyfood, Dinner, Macaroni And Tomato'");
	});

	it("provides regulated alcohol safety fixtures and a non-alcoholic control", () => {
		expect(seed).toContain("'09000000000209'");
		expect(seed).toContain("'QA Federal Label Mystery Beer'");
		expect(seed).toContain("'09000000000216'");
		expect(seed).toContain('"allergens": ["wheat"]');
		expect(seed).toContain("'09000000000223'");
		expect(seed).toContain('"allergens": ["sulfites"]');
		expect(seed).toContain("'09000000000230'");
		expect(seed).toContain('"profileKey":"us-ttb-alcohol-beverage-v1"');
		expect(seed).toContain(
			"('alcoholByVolume', fixture.food -> 'alcoholByVolume'",
		);
		expect(seed).toContain(
			"('regulatoryDisclosure', fixture.food -> 'regulatoryDisclosure'",
		);
	});

	it("provides authoritative generic-food deep-dive fixtures", () => {
		expect(seed).toContain("'qa-usda-sr-legacy'");
		expect(seed).toContain("'Blueberries, raw'");
		expect(seed).toContain(
			"'Crustaceans, shrimp, mixed species, raw (may contain additives to retain moisture)'",
		);
		expect(seed).toContain(
			"'https://fdc.nal.usda.gov/food-details/171711/nutrients'",
		);
		expect(seed).toContain("'CC0 1.0 / U.S. public domain'");
		expect(seed).toContain("public.generic_food_source_identifiers");
		expect(seed).toContain("'fdc-portion-93941'");
	});

	it("provides licensed image attribution without a live image-source request", () => {
		expect(seed).toContain("insert into public.food_image_assets");
		expect(seed).toContain(
			"'https://world.openfoodfacts.org/product/0021130493609'",
		);
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
