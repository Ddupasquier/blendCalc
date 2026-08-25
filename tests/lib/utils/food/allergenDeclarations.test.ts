import { describe, expect, it } from "vitest";
import { analyzeIngredientLabelAllergenDeclarations } from "$lib/server/products/allergenDeclarations.server.js";

const analyzeEnglishDeclaration = (value: string) =>
	analyzeIngredientLabelAllergenDeclarations(value, {
		languageCode: "en",
		sourceField: "ingredients",
	});

describe("explicit allergen declarations", () => {
	it("extracts contains and may-contain label statements", () => {
		expect(
			analyzeEnglishDeclaration(
				"Ingredients: rice, seasoning. CONTAINS: MILK, WHEAT AND SOY; May contain peanuts and tree nuts.",
			),
		).toMatchObject({
			method: "bounded-ingredient-label-pattern",
			sourceField: "ingredients",
			languageCode: "en",
			languageStatus: "supported",
			extractionStatus: "parsed",
			contains: ["Milk", "Wheat", "Soy"],
			mayContain: ["peanuts", "tree nuts"],
			statements: [
				{
					type: "contains",
					text: "CONTAINS: MILK, WHEAT AND SOY",
					allergens: ["Milk", "Wheat", "Soy"],
				},
				{
					type: "may_contain",
					text: "May contain peanuts and tree nuts",
					allergens: ["peanuts", "tree nuts"],
				},
			],
		});
	});

	it("extracts shared-facility trace statements", () => {
		expect(
			analyzeEnglishDeclaration(
				"Potatoes, oil, salt. Made in a facility that also processes milk and eggs.",
			),
		).toMatchObject({
			extractionStatus: "parsed",
			contains: [],
			mayContain: ["milk", "eggs"],
			statements: [
				{
					type: "shared_facility",
					text: "Made in a facility that also processes milk and eggs",
					allergens: ["milk", "eggs"],
				},
			],
		});
	});

	it("stops before source boilerplate after a declaration", () => {
		expect(
			analyzeEnglishDeclaration(
				"Almondmilk, salt. Contains Almonds All products are produced in an allergen control environment.",
			),
		).toMatchObject({
			extractionStatus: "parsed",
			contains: ["Almonds"],
			mayContain: [],
			statements: [
				{
					type: "contains",
					text: "Contains Almonds",
					allergens: ["Almonds"],
				},
			],
		});
	});

	it("does not infer allergens from ordinary ingredients", () => {
		expect(
			analyzeEnglishDeclaration(
				"Soybean paste, wheat extract, milk powder, peanuts.",
			),
		).toMatchObject({
			extractionStatus: "none",
			contains: [],
			mayContain: [],
			statements: [],
		});
	});

	it("does not mistake ingredient percentages for allergen declarations", () => {
		expect(
			analyzeEnglishDeclaration(
				"Strawberry juice, corn syrup, CONTAINS LESS THAN 2% OF FRUIT PECTIN, CITRIC ACID.",
			),
		).toMatchObject({
			extractionStatus: "none",
			contains: [],
			mayContain: [],
			statements: [],
		});
	});

	it("preserves shared-equipment wording without assigning a risk rank", () => {
		expect(
			analyzeEnglishDeclaration(
				"Made on shared equipment that also processes sesame and milk.",
			),
		).toMatchObject({
			mayContain: ["sesame", "milk"],
			statements: [
				{
					type: "shared_equipment",
					text: "Made on shared equipment that also processes sesame and milk",
					allergens: ["sesame", "milk"],
				},
			],
		});
	});

	it("keeps an unknown language explicit while parsing bounded English markers", () => {
		expect(
			analyzeIngredientLabelAllergenDeclarations("Contains milk and soy.", {
				sourceField: "ingredients",
			}),
		).toMatchObject({
			languageStatus: "unknown",
			extractionStatus: "parsed",
			contains: ["milk", "soy"],
			statements: [
				{
					type: "contains",
					text: "Contains milk and soy",
				},
			],
		});
	});

	it.each([
		["fr", "Contient du lait et du soja."],
		["es", "Contiene leche y soja."],
	])("skips unreviewed %s declaration syntax", (languageCode, value) => {
		expect(
			analyzeIngredientLabelAllergenDeclarations(value, {
				languageCode,
				sourceField: "ingredients_text",
			}),
		).toMatchObject({
			languageCode,
			languageStatus: "unsupported",
			extractionStatus: "skipped",
			contains: [],
			mayContain: [],
			statements: [],
		});
	});
});
