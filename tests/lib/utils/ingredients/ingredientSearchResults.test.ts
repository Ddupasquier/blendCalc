import { describe, expect, it } from "vitest";
import {
	isUsableIngredientSearchResult,
	mergeIngredientSearchResults,
	sortIngredientSearchResults,
} from "$lib/utils/ingredients/ingredientSearchResults";
import type { FoodItem } from "$lib/utils/food/types";

const food = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	fdcId: 1,
	description: "Test Food",
	foodNutrients: [
		{
			nutrientId: 1008,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "kcal",
			value: 100,
		},
	],
	...overrides,
});

describe("ingredient search result merging", () => {
	it("downranks equal-relevance foods with preference conflicts", () => {
		const safeFood = food({ fdcId: 1, description: "Apple" });
		const conflictingFood = food({
			fdcId: 2,
			description: "Apple",
			preferenceWarnings: [
				{
					id: "restriction-conflict",
					level: "warning",
					category: "restriction",
					label: "Vegan",
					code: "FOOD_RESTRICTION_CONFLICT",
					params: { preference: "Vegan", fact: "Meat" },
				},
			],
		});

		expect(
			sortIngredientSearchResults([conflictingFood, safeFood], "apple").map(
				(result) => result.fdcId,
			),
		).toEqual([1, 2]);
	});

	it("merges exact legacy records per field instead of choosing one whole record", () => {
		const usda = food({
			fdcId: 171032,
			description: "Oil, Apricot Kernel",
			sourceIdentifiers: {
				usdaFdcId: "171032",
				usdaNdbNumber: "04530",
			},
			foodCategory: "Fats and oils",
			fieldProvenance: {
				productName: {
					source: "usda",
					sourceReference: "171032",
					confidence: "imported",
				},
				nutrition: {
					source: "usda",
					sourceReference: "171032",
					confidence: "imported",
				},
				categories: {
					source: "usda",
					sourceReference: "171032",
					confidence: "imported",
				},
			},
		});
		const cnf = food({
			fdcId: -4491358547542380,
			description: "Vegetable Oil, Apricot Kernel",
			sourceIdentifiers: {
				datasetFoodKey: "cnf-2026:441",
				usdaNdbNumber: "04530",
			},
			foodNutrients: [
				...usda.foodNutrients,
				{
					nutrientId: 1004,
					nutrientName: "Total Fat",
					nutrientNumber: "204",
					unitName: "g",
					value: 100,
				},
			],
			foodServings: [
				{
					label: "15 ml",
					gramWeight: 13.784,
					isPrimary: true,
					source: "health-canada-cnf",
				},
			],
			preparation: "Unheated",
			fieldProvenance: {
				productName: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:441",
					confidence: "imported",
				},
				nutrition: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:441",
					confidence: "imported",
				},
				serving: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:441",
					confidence: "imported",
				},
				sourceMetadata: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:441",
					confidence: "imported",
				},
			},
		});

		const [merged] = mergeIngredientSearchResults([usda], [cnf]);
		expect(merged).toMatchObject({
			description: "Vegetable Oil, Apricot Kernel",
			foodCategory: "Fats and oils",
			preparation: "Unheated",
			foodServings: cnf.foodServings,
			sourceIdentifiers: {
				usdaFdcId: "171032",
				usdaNdbNumber: "04530",
				datasetFoodKey: "cnf-2026:441",
			},
			fieldProvenance: {
				productName: { source: "health-canada-cnf" },
				categories: { source: "usda" },
				serving: { source: "health-canada-cnf" },
				sourceMetadata: { source: "health-canada-cnf" },
			},
		});
		expect(merged?.foodNutrients.map(({ nutrientId }) => nutrientId)).toEqual([
			1004, 1008,
		]);
	});

	it("keeps unrelated records and merges duplicate ids", () => {
		const first = food();
		const richerDuplicate = food({
			foodNutrients: [
				...first.foodNutrients,
				{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "g",
					value: 1,
				},
			],
		});
		const other = food({ fdcId: 2, description: "Other Food" });

		expect(
			mergeIngredientSearchResults([first, other], [richerDuplicate]),
		).toEqual([first, other]);
	});

	it("does not discard an existing nutrient when another exact source adds one", () => {
		const existing = food({
			fdcId: 30,
			sourceIdentifiers: { usdaNdbNumber: "30000" },
			reportedNutrientIds: [1008],
		});
		const supplement = food({
			fdcId: 31,
			sourceIdentifiers: { usdaNdbNumber: "30000" },
			foodNutrients: [
				{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "g",
					value: 8,
					valueOrigin: "reported",
				},
			],
			reportedNutrientIds: [1003],
			fieldProvenance: {
				nutrition: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:31",
					confidence: "imported",
				},
			},
		});

		const [merged] = mergeIngredientSearchResults([existing], [supplement]);
		expect(merged?.foodNutrients.map(({ nutrientId }) => nutrientId)).toEqual([
			1003, 1008,
		]);
		expect(merged?.reportedNutrientIds).toEqual([1003, 1008]);
	});

	it("uses explicit nutrition field confidence when a nutrient omits its own confidence", () => {
		const reviewed = food({
			fdcId: 32,
			sourceIdentifiers: { usdaNdbNumber: "30001" },
			foodNutrients: [
				{
					...food().foodNutrients[0],
					value: 120,
					source: "usda",
					valueOrigin: "reported",
				},
			],
			fieldProvenance: {
				nutrition: {
					source: "usda",
					sourceReference: "32",
					confidence: "source-verified",
				},
			},
		});
		const imported = food({
			fdcId: 33,
			sourceIdentifiers: { usdaNdbNumber: "30001" },
			foodNutrients: [
				{
					...food().foodNutrients[0],
					value: 100,
					source: "health-canada-cnf",
					confidence: "imported",
					valueOrigin: "reported",
				},
			],
		});

		const [merged] = mergeIngredientSearchResults([reviewed], [imported]);
		expect(merged?.foodNutrients[0]).toMatchObject({
			value: 120,
			source: "usda",
			sourceReference: "32",
			confidence: "source-verified",
		});
	});

	it("normalizes equivalent GTIN representations before merging", () => {
		const upc = food({
			fdcId: 10,
			barcode: "041570054130",
			fieldProvenance: {
				productName: {
					source: "usda",
					sourceReference: "10",
					confidence: "imported",
				},
			},
		});
		const gtin = food({
			fdcId: 11,
			barcode: "00041570054130",
			foodCategory: "Sauces",
			fieldProvenance: {
				categories: {
					source: "open-food-facts",
					sourceReference: "00041570054130",
					confidence: "imported",
				},
			},
		});

		expect(mergeIngredientSearchResults([upc], [gtin])).toHaveLength(1);
		expect(mergeIngredientSearchResults([upc], [gtin])[0]?.foodCategory).toBe(
			"Sauces",
		);
	});

	it("normalizes exact USDA identifiers before merging", () => {
		const fdcFood = food({
			fdcId: 40,
			sourceIdentifiers: {
				usdaFdcId: "000040",
				usdaNdbNumber: "4530",
			},
		});
		const linkedFood = food({
			fdcId: 41,
			sourceIdentifiers: {
				usdaFdcId: "40",
				usdaNdbNumber: "04530",
			},
			foodCategory: "Fats and oils",
			fieldProvenance: {
				categories: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:441",
					confidence: "imported",
				},
			},
		});

		expect(mergeIngredientSearchResults([fdcFood], [linkedFood])).toHaveLength(
			1,
		);
	});

	it("retains every dataset attribution represented by merged fields", () => {
		const usda = food({
			fdcId: 171032,
			sourceIdentifiers: { usdaNdbNumber: "04530" },
			sourceAttribution: {
				datasetKey: "usda-sr-legacy",
				datasetName: "USDA SR Legacy",
				datasetVersion: "2018",
				sourceName: "USDA",
				sourceUrl: "https://example.com/usda",
				licenseName: "Public domain",
				licenseUrl: "https://example.com/usda-license",
				attributionText: "USDA",
			},
		});
		const cnf = food({
			fdcId: 20,
			sourceIdentifiers: { usdaNdbNumber: "04530" },
			sourceAttribution: {
				datasetKey: "cnf-2026",
				datasetName: "CNF",
				datasetVersion: "2026",
				sourceName: "Health Canada",
				sourceUrl: "https://example.com/cnf",
				licenseName: "OGL Canada",
				licenseUrl: "https://example.com/cnf-license",
				attributionText: "Health Canada",
			},
		});

		expect(
			mergeIngredientSearchResults([usda], [cnf])[0]?.sourceAttributions,
		).toHaveLength(2);
	});

	it("does not merge similarly named foods without an exact identity link", () => {
		const first = food({
			fdcId: 100,
			description: "Tomatoes, Roma",
			sourceIdentifiers: { usdaFdcId: "100" },
		});
		const second = food({
			fdcId: 200,
			description: "Tomatoes, Roma",
			sourceIdentifiers: { datasetFoodKey: "cnf-2026:200" },
		});

		expect(mergeIngredientSearchResults([first], [second])).toEqual([
			first,
			second,
		]);
	});

	it("keeps a private unmatched food separate when its identifier resembles a provider record", () => {
		const privateFood = food({
			fdcId: -100,
			description: "My test sauce",
			barcode: "041570054130",
			customFood: true,
			foodIdentityType: "private-custom",
			barcodeSource: "manual",
			sourceKey: "custom",
			trustStatus: "user-private",
		});
		const providerFood = food({
			fdcId: 2757275,
			description: "Provider sauce",
			barcode: "00041570054130",
			sourceKey: "usda",
		});

		expect(mergeIngredientSearchResults([privateFood], [providerFood])).toEqual(
			[privateFood, providerFood],
		);
	});

	it("keeps preparation independent from broader source-record metadata", () => {
		const preparationSource = food({
			fdcId: 301,
			sourceIdentifiers: { usdaNdbNumber: "12345" },
			preparation: "Cooked, drained",
			fieldProvenance: {
				preparation: {
					source: "usda",
					sourceReference: "301",
					confidence: "source-verified",
				},
			},
		});
		const metadataSource = food({
			fdcId: 302,
			sourceIdentifiers: { usdaNdbNumber: "12345" },
			sourceMetadata: {
				language: "en",
				languages: ["en", "fr"],
				marketCountries: ["Canada"],
				revision: 4,
				modifiedAt: "2026-08-01T00:00:00.000Z",
			},
			fieldProvenance: {
				sourceMetadata: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:302",
					confidence: "imported",
				},
			},
		});

		const [merged] = mergeIngredientSearchResults(
			[preparationSource],
			[metadataSource],
		);
		expect(merged?.preparation).toBe("Cooked, drained");
		expect(merged?.sourceMetadata).toEqual(metadataSource.sourceMetadata);
		expect(merged?.fieldProvenance?.preparation?.source).toBe("usda");
	});

	it("retains provenance when a descriptive field comes from a non-base record", () => {
		const base = food({
			fdcId: 310,
			sourceIdentifiers: {
				usdaFdcId: "310",
				usdaNdbNumber: "00310",
			},
		});
		const preparationSource = food({
			fdcId: 311,
			sourceIdentifiers: { usdaNdbNumber: "00310" },
			preparation: "Cooked, drained",
			fieldProvenance: {
				preparation: {
					source: "health-canada-cnf",
					sourceReference: "cnf-2026:311",
					confidence: "imported",
				},
			},
		});

		const [merged] = mergeIngredientSearchResults([base], [preparationSource]);
		expect(merged?.preparation).toBe("Cooked, drained");
		expect(merged?.fieldProvenance?.preparation).toEqual({
			source: "health-canada-cnf",
			sourceReference: "cnf-2026:311",
			confidence: "imported",
		});
	});

	it("keeps the canonical shared-catalog record ahead of a richer provider duplicate", () => {
		const catalogFood = food({
			fdcId: -1,
			barcode: "00041570054130",
			sharedProductId: "shared-product-id",
			dataType: "Shared Product",
		});
		const providerFood = food({
			fdcId: 2757275,
			barcode: "00041570054130",
			foodNutrients: [
				...catalogFood.foodNutrients,
				{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "g",
					value: 1,
				},
			],
		});

		expect(mergeIngredientSearchResults([catalogFood], [providerFood])).toEqual(
			[catalogFood],
		);
		expect(mergeIngredientSearchResults([providerFood], [catalogFood])).toEqual(
			[catalogFood],
		);
	});

	it("maps linked provider identifiers to the untouched canonical result", () => {
		const catalogFood = food({
			fdcId: -1,
			barcode: "00041570054130",
			sharedProductId: "shared-product-id",
			dataType: "Shared Product",
		});
		const barcodeProvider = food({
			fdcId: 400,
			barcode: "041570054130",
			sourceIdentifiers: { usdaNdbNumber: "54321" },
		});
		const linkedDatasetFood = food({
			fdcId: 401,
			sourceIdentifiers: { usdaNdbNumber: "54321" },
		});

		expect(
			mergeIngredientSearchResults(
				[catalogFood],
				[barcodeProvider],
				[linkedDatasetFood],
			),
		).toEqual([catalogFood]);
	});

	it("coalesces an exact-identity cluster joined by a later bridge record", () => {
		const barcodeFood = food({
			fdcId: 500,
			barcode: "041570054130",
			fieldProvenance: {
				productName: {
					source: "open-food-facts",
					sourceReference: "041570054130",
					confidence: "imported",
				},
			},
		});
		const legacyFood = food({
			fdcId: 501,
			sourceIdentifiers: { usdaNdbNumber: "67890" },
			foodCategory: "Sauces",
			fieldProvenance: {
				categories: {
					source: "usda",
					sourceReference: "501",
					confidence: "imported",
				},
			},
		});
		const bridgeFood = food({
			fdcId: 502,
			barcode: "00041570054130",
			sourceIdentifiers: { usdaNdbNumber: "67890" },
		});

		const merged = mergeIngredientSearchResults(
			[barcodeFood],
			[legacyFood],
			[bridgeFood],
		);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.foodCategory).toBe("Sauces");
	});
});

describe("usable ingredient search results", () => {
	it("keeps nutrient-bearing foods and safety-alert records without invented nutrition", () => {
		expect(isUsableIngredientSearchResult(food())).toBe(true);
		expect(isUsableIngredientSearchResult(food({ foodNutrients: [] }))).toBe(
			false,
		);
		expect(
			isUsableIngredientSearchResult(
				food({
					foodNutrients: [],
					safetyAlerts: [
						{
							id: "alert-1",
							providerKey: "fda-food-enforcement",
							sourceName: "FDA",
							sourceAttribution: "FDA",
							alertType: "recall",
							status: "ongoing",
							productDescription: "Recalled lettuce",
							sourceUrl: "https://www.fda.gov/example",
							matchType: "exact_gtin",
							requiresPackageCheck: true,
							detectedAt: "2026-08-14T12:00:00.000Z",
						},
					],
				}),
			),
		).toBe(true);
	});
});
