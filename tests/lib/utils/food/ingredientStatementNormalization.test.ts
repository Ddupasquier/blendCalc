import { describe, expect, it } from "vitest";
import { normalizeExternalIngredientStatement } from "$lib/utils/food/ingredients/ingredientStatementNormalization.js";

const normalizeEnglish = (value: string) =>
	normalizeExternalIngredientStatement(value, {
		languageCode: "en",
		sourceField: "ingredients",
	});

describe("external ingredient statement normalization", () => {
	it("removes provider markup and formats all-caps English statements", () => {
		expect(normalizeEnglish("DRY ROASTED _PEANUTS_, SALT")).toMatchObject({
			ingredientText: "Dry roasted peanuts, salt",
			ingredientList: ["Dry roasted peanuts", "salt"],
			normalization: {
				method: "external-ingredient-statement",
				version: 1,
				languageCode: "en",
			},
		});
	});

	it("keeps nested ingredient groups together", () => {
		const result = normalizeEnglish(
			"ROMA TOMATO, RED ONION, GARLIC (WATER, GARLIC), NATURAL FLAVOR, SALT.",
		);

		expect(result.ingredientText).toBe(
			"Roma tomato, red onion, garlic (water, garlic), natural flavor, salt",
		);
		expect(result.ingredientList).toEqual([
			"Roma tomato",
			"red onion",
			"garlic (water, garlic)",
			"natural flavor",
			"salt",
		]);
	});

	it("separates explicit allergen and precautionary statements", () => {
		const result = normalizeEnglish(
			"Other Ingredients: ALMONDMILK (FILTERED WATER, ALMONDS), SEA SALT. CONTAINS ALMONDS. MAY CONTAIN SOY.",
		);

		expect(result.ingredientText).toBe(
			"Almondmilk (filtered water, almonds), sea salt",
		);
		expect(result.declarationAnalysis).toMatchObject({
			contains: ["Almonds"],
			mayContain: ["Soy"],
		});
		expect(result.precautionaryStatements).toEqual([
			expect.objectContaining({
				type: "may_contain",
				allergens: ["Soy"],
			}),
		]);
	});

	it("does not mistake an ingredient percentage for an allergen warning", () => {
		const result = normalizeEnglish(
			"STRAWBERRY JUICE, CORN SYRUP, CONTAINS LESS THAN 2% OF FRUIT PECTIN, CITRIC ACID.",
		);

		expect(result.ingredientText).toContain("contains less than 2%");
		expect(result.declarationAnalysis.extractionStatus).toBe("none");
	});

	it("preserves mixed-case source wording", () => {
		expect(
			normalizeEnglish("Cultured milk, Greek yogurt cultures, vitamin D3")
				.ingredientText,
		).toBe("Cultured milk, Greek yogurt cultures, vitamin D3");
	});

	it("preserves unsupported-language casing while cleaning safe artifacts", () => {
		const result = normalizeExternalIngredientStatement(
			"RIZ,  _CACAO_. CONTIENT DU LAIT.",
			{ languageCode: "fr", sourceField: "ingredients_text" },
		);

		expect(result.ingredientText).toBe("RIZ, CACAO. CONTIENT DU LAIT");
		expect(result.declarationAnalysis.extractionStatus).toBe("skipped");
	});

	it("preserves technical terms in all-caps English source text", () => {
		expect(
			normalizeEnglish("OIL, TBHQ, VITAMIN D3, RED 40, E 330").ingredientText,
		).toBe("Oil, TBHQ, vitamin D3, red 40, E330");
	});

	it("is idempotent", () => {
		const first = normalizeEnglish(
			"INGREDIENTS: WATER, ALMONDS, SEA SALT. CONTAINS: ALMONDS.",
		);
		const second = normalizeEnglish(first.ingredientText);

		expect(second.ingredientText).toBe(first.ingredientText);
		expect(second.ingredientList).toEqual(first.ingredientList);
	});
});
