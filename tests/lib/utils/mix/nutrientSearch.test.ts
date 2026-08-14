import { describe, expect, it } from "vitest";
import { searchNutrientCatalog } from "$lib/utils/mix/nutrients/nutrientSearch";
import { getNutrientCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

describe("nutrient catalog search", () => {
	it("includes the expanded FDC nutrient catalog without duplicate IDs", () => {
		const nutrientCatalog = getNutrientCatalog();
		const ids = nutrientCatalog.map((nutrient) => nutrient.id);

		expect(nutrientCatalog.length).toBeGreaterThan(10);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("ranks direct nutrient-name matches before broader matches", () => {
		const results = searchNutrientCatalog(getNutrientCatalog(), "magnesium");

		expect(results[0]).toMatchObject({
			id: 1090,
			label: "Magnesium",
			unit: "mg",
		});
	});

	it("searches by unit and FDC nutrient ID", () => {
		expect(searchNutrientCatalog(getNutrientCatalog(), "1235")[0]).toMatchObject({
			id: 1235,
			label: "Added Sugars",
		});
	});

	it("matches familiar nutrient wording across punctuation differences", () => {
		expect(
			searchNutrientCatalog(
				[{ id: 1178, label: "Vitamin B-12", unit: "mcg" }],
				"Vitamin B12",
			),
		).toEqual([{ id: 1178, label: "Vitamin B-12", unit: "mcg" }]);
	});
});
