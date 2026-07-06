import { describe, expect, it } from "vitest";
import { searchNutrientCatalog } from "$lib/utils/mix/nutrients/nutrientSearch";
import { ALL_NUTRIENTS } from "../../../../src/variables/allNutrients";

describe("nutrient catalog search", () => {
	it("includes the expanded FDC nutrient catalog without duplicate IDs", () => {
		const ids = ALL_NUTRIENTS.map((nutrient) => nutrient.id);

		expect(ALL_NUTRIENTS.length).toBeGreaterThan(200);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("ranks direct nutrient-name matches before broader matches", () => {
		const results = searchNutrientCatalog(ALL_NUTRIENTS, "magnesium");

		expect(results[0]).toMatchObject({
			id: 1090,
			label: "Magnesium",
			unit: "mg",
		});
	});

	it("searches by unit and FDC nutrient ID", () => {
		expect(searchNutrientCatalog(ALL_NUTRIENTS, "1235")[0]).toMatchObject({
			id: 1235,
			label: "Added Sugars",
		});
	});
});
