import { describe, expect, it } from "vitest";
import { extractExplicitAllergenDeclarations } from "$lib/server/products/allergenDeclarations.server.js";

describe("explicit allergen declarations", () => {
	it("extracts contains and may-contain label statements", () => {
		expect(
			extractExplicitAllergenDeclarations(
				"Ingredients: rice, seasoning. CONTAINS: MILK, WHEAT AND SOY; May contain peanuts and tree nuts.",
			),
		).toEqual({
			contains: ["Milk", "Wheat", "Soy"],
			mayContain: ["peanuts", "tree nuts"],
			precautionaryStatements: [{
				type: "may_contain",
				text: "May contain peanuts and tree nuts",
				allergens: ["peanuts", "tree nuts"],
				sourceField: "ingredients",
			}],
		});
	});

	it("extracts shared-facility trace statements", () => {
		expect(
			extractExplicitAllergenDeclarations(
				"Potatoes, oil, salt. Made in a facility that also processes milk and eggs.",
			),
		).toEqual({
			contains: [],
			mayContain: ["milk", "eggs"],
			precautionaryStatements: [{
				type: "shared_facility",
				text: "Made in a facility that also processes milk and eggs",
				allergens: ["milk", "eggs"],
				sourceField: "ingredients",
			}],
		});
	});

	it("stops before source boilerplate after a declaration", () => {
		expect(
			extractExplicitAllergenDeclarations(
				"Almondmilk, salt. Contains Almonds All products are produced in an allergen control environment.",
			),
		).toEqual({
			contains: ["Almonds"],
			mayContain: [],
			precautionaryStatements: [],
		});
	});

	it("does not infer allergens from ordinary ingredients", () => {
		expect(
			extractExplicitAllergenDeclarations(
				"Soybean paste, wheat extract, milk powder, peanuts.",
			),
		).toEqual({
			contains: [],
			mayContain: [],
			precautionaryStatements: [],
		});
	});

	it("does not mistake ingredient percentages for allergen declarations", () => {
		expect(
			extractExplicitAllergenDeclarations(
				"Strawberry juice, corn syrup, CONTAINS LESS THAN 2% OF FRUIT PECTIN, CITRIC ACID.",
			),
		).toEqual({
			contains: [],
			mayContain: [],
			precautionaryStatements: [],
		});
	});

	it("preserves shared-equipment wording without assigning a risk rank", () => {
		expect(
			extractExplicitAllergenDeclarations(
				"Made on shared equipment that also processes sesame and milk.",
			),
		).toMatchObject({
			mayContain: ["sesame", "milk"],
			precautionaryStatements: [{
				type: "shared_equipment",
				text: "Made on shared equipment that also processes sesame and milk",
				allergens: ["sesame", "milk"],
			}],
		});
	});
});
