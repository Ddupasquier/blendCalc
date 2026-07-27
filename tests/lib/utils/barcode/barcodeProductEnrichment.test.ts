import { describe, expect, it } from "vitest";
import {
	applyCachedImageToBarcodeDraft,
	getBarcodeProductSupplementPlan,
	getMissingBarcodeProductFields,
	getSupplementedBarcodeProductFields,
	mergeMissingBarcodeProductFields,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { FdcNutrient, FoodImageAsset } from "$lib/utils/food/types";

const nutrient = (
	value: number,
	source: NonNullable<FdcNutrient["source"]>,
): FdcNutrient => ({
	nutrientId: 1079,
	nutrientName: "Fiber, total dietary",
	nutrientNumber: "291",
	unitName: "G",
	value,
	valueOrigin: "reported",
	source,
	sourceReference: source === "usda" ? "2658692" : "00021130493609",
	confidence: "unknown",
});

const makeDraft = (
	source: BarcodeProductDraft["source"],
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
	barcode: "00021130493609",
	name: "Roasted Onion & Garlic Pasta Sauce",
	nameProvenance: "source",
	brandOwner: "Signature Select",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: false,
	nutrients: [nutrient(2, source === "usda" ? "usda" : "open-food-facts")],
	reportedNutrientIds: [1079],
	categories: [],
	source,
	sourceLabel:
		source === "usda" ? "USDA FoodData Central" : "Open Food Facts",
	sourceReference: source === "usda" ? "2658692" : "00021130493609",
	fieldProvenance: {
		nutrition: {
			source: source === "usda" ? "usda" : "open-food-facts",
			sourceReference: source === "usda" ? "2658692" : "00021130493609",
			confidence: "unknown",
		},
	},
	...overrides,
});

const openFoodFactsImage: FoodImageAsset = {
	source: "open-food-facts",
	sourceReference: "00021130493609",
	role: "front",
	imageUrl: "https://images.openfoodfacts.org/product.jpg",
	licenseName: "CC BY-SA",
	confidence: "imported",
};

describe("barcode product field enrichment", () => {
	it("tracks missing nutrition, image, category, and serving independently", () => {
		expect(getMissingBarcodeProductFields(makeDraft("usda"))).toEqual({
			nutrition: false,
			image: true,
			categories: true,
			serving: true,
			ingredients: true,
			allergens: true,
			traces: true,
			dietaryTags: true,
			labels: true,
			structuredIngredients: true,
			ingredientAnalysis: true,
			additives: true,
			package: true,
			sourceMetadata: true,
		});
	});

	it("plans optional metadata enrichment independently from core fields", () => {
		const plan = getBarcodeProductSupplementPlan(
			makeDraft("usda", {
				image: openFoodFactsImage,
				categories: ["Pasta sauces"],
				hasSourceServing: true,
			}),
			[1079, 1003],
		);

		expect(plan).toMatchObject({
			nutrition: false,
			image: false,
			categories: false,
			serving: false,
			ingredients: true,
			ingredientList: true,
			allergens: true,
			traces: true,
			dietaryTags: true,
			labels: true,
			structuredIngredients: true,
			ingredientAnalysis: true,
			additives: true,
			package: true,
			sourceMetadata: true,
			missingNutrientIds: [1003],
		});
	});

	it("keeps USDA nutrition while filling image, category, and serving fields", () => {
		const usda = makeDraft("usda");
		const openFoodFacts = makeDraft("open-food-facts", {
			servingLabel: "1/2 cup (125 g)",
			servingWeightGrams: 125,
			hasSourceServing: true,
			nutrients: [
				nutrient(2.4, "open-food-facts"),
				{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 1,
					valueOrigin: "reported",
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "unknown",
				},
			],
			reportedNutrientIds: [1079, 1003],
			categories: ["Pasta sauces"],
			image: openFoodFactsImage,
			fieldProvenance: {
				nutrition: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "unknown",
				},
				image: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "unknown",
				},
				categories: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "unknown",
				},
				serving: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "unknown",
				},
			},
		});

		const result = mergeMissingBarcodeProductFields(usda, openFoodFacts);
		expect(getSupplementedBarcodeProductFields(usda, openFoodFacts)).toEqual([
			"nutrition",
			"image",
			"categories",
			"serving",
		]);

		expect(result.source).toBe("usda");
		expect(result.nutrients[0]).toMatchObject({
			value: 2.5,
			source: "usda",
		});
		expect(result.nutrients.find((item) => item.nutrientId === 1003)).toMatchObject({
			value: 1,
			source: "open-food-facts",
		});
		expect(result.reportedNutrientIds).toContain(1003);
		expect(result).toMatchObject({
			servingLabel: "1/2 cup (125 g)",
			servingWeightGrams: 125,
			hasSourceServing: true,
			categories: ["Pasta sauces"],
			image: openFoodFactsImage,
		});
		expect(result.fieldProvenance).toMatchObject({
			nutrition: { source: "usda" },
			image: { source: "open-food-facts" },
			categories: { source: "open-food-facts" },
			serving: { source: "open-food-facts" },
		});
	});

	it("uses fallback nutrition only when primary nutrition is absent", () => {
		const usda = makeDraft("usda", {
			servingLabel: "125 g",
			servingWeightGrams: 125,
			hasSourceServing: true,
			nutrients: [],
			reportedNutrientIds: [],
			fieldProvenance: {
				serving: {
					source: "usda",
					sourceReference: "2658692",
					confidence: "unknown",
				},
			},
		});
		const openFoodFacts = makeDraft("open-food-facts", {
			servingLabel: "50 g",
			servingWeightGrams: 50,
			hasSourceServing: true,
			nutrients: [nutrient(1, "open-food-facts")],
		});

		const result = mergeMissingBarcodeProductFields(usda, openFoodFacts);

		expect(result.nutrients[0]).toMatchObject({
			value: 2.5,
			source: "open-food-facts",
		});
		expect(result.servingWeightGrams).toBe(125);
		expect(result.fieldProvenance?.nutrition?.source).toBe("open-food-facts");
	});

	it("merges source-provided ingredient and allergen metadata independently", () => {
		const usda = makeDraft("usda", {
			ingredients: "Peanuts, sugar",
			ingredientList: ["Peanuts", "sugar"],
			allergens: ["peanuts"],
		});
		const openFoodFacts = makeDraft("open-food-facts", {
			ingredients: "Peanuts, sugar, milk",
			ingredientList: ["peanuts", "Sugar", "milk"],
			allergens: ["Peanuts", "milk"],
			traces: ["tree nuts"],
			dietaryTags: ["vegetarian"],
			labels: ["Rainforest Alliance"],
			structuredIngredients: [{ id: "milk", text: "milk" }],
			ingredientAnalysis: {
				ingredientTags: ["milk"],
				analysisTags: ["non vegan"],
				derivedTraceTags: ["tree nuts"],
			},
			additives: ["e330"],
			packageQuantity: { label: "12 oz", amount: 12, unit: "oz" },
			sourceMetadata: { revision: 4 },
		});

		const result = mergeMissingBarcodeProductFields(usda, openFoodFacts);

		expect(result.ingredients).toBe("Peanuts, sugar");
		expect(result.ingredientList).toEqual(["Peanuts", "sugar", "milk"]);
		expect(result.allergens).toEqual(["peanuts", "milk"]);
		expect(result.traces).toEqual(["tree nuts"]);
		expect(result.dietaryTags).toEqual(["vegetarian"]);
		expect(result.labels).toEqual(["Rainforest Alliance"]);
		expect(result.structuredIngredients).toEqual([{ id: "milk", text: "milk" }]);
		expect(result.ingredientAnalysis).toEqual({
			ingredientTags: ["milk"],
			analysisTags: ["non vegan"],
			derivedTraceTags: ["tree nuts"],
			percentAnalysis: undefined,
			percentEstimate: undefined,
			percentKnown: undefined,
			percentUnknown: undefined,
		});
		expect(result.additives).toEqual(["e330"]);
		expect(result.packageQuantity).toEqual({
			label: "12 oz",
			amount: 12,
			unit: "oz",
		});
		expect(result.sourceMetadata).toEqual({ revision: 4 });
		expect(result.source).toBe("usda");
	});

	it("lets a cached DB image override an API image and records its source", () => {
		const cachedImage: FoodImageAsset = {
			...openFoodFactsImage,
			source: "community-reviewed",
			sourceReference: "approved/front.jpg",
			imageUrl: "https://example.com/approved/front.jpg",
			confidence: "moderator-reviewed",
		};

		const result = applyCachedImageToBarcodeDraft(
			makeDraft("usda", { image: openFoodFactsImage }),
			cachedImage,
		);

		expect(result.image).toEqual(cachedImage);
		expect(result.fieldProvenance?.image).toEqual({
			source: "community-reviewed",
			sourceReference: "approved/front.jpg",
			confidence: "moderator-reviewed",
		});
	});
});
