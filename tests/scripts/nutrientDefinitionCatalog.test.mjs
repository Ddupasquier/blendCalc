import { describe, expect, it } from "vitest";
import { createNutrientDefinitionCatalog } from "../../scripts/lib/reference-data/nutrientDefinitions.mjs";

describe("nutrient definition catalog", () => {
	it("reuses the canonical definition when a new source ID has the same nutrient number", () => {
		const catalog = createNutrientDefinitionCatalog([{
			nutrient_id: 700861,
			nutrient_name: "Fatty acids, polyunsaturated, 22:3",
			nutrient_number: "861",
			default_unit_name: "G",
		}]);

		const definition = catalog.resolve(199999, "861") ?? catalog.register({
			nutrient_id: 199999,
			nutrient_name: "Duplicate source label",
			nutrient_number: "861",
			default_unit_name: "G",
		});

		expect(definition.nutrient_id).toBe(700861);
		expect([...catalog.values()]).toHaveLength(1);
	});

	it("registers a genuinely new nutrient exactly once", () => {
		const catalog = createNutrientDefinitionCatalog([]);
		const definition = {
			nutrient_id: 123456,
			nutrient_name: "Observed nutrient",
			nutrient_number: "X-123456",
			default_unit_name: "MG",
		};

		expect(catalog.register(definition)).toEqual(definition);
		expect(catalog.register(definition)).toEqual(definition);
		expect([...catalog.values()]).toHaveLength(1);
	});
});
