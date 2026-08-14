import { describe, expect, it, vi } from "vitest";
import {
	lookupExternalBarcodeProduct,
} from "$lib/server/products/externalProduct.server";
import { areExternalProductLookupsEnabled } from "$lib/server/products/externalProductPolicy.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";

const makeDraft = (
	source: BarcodeProductDraft["source"],
	image: BarcodeProductDraft["image"] = undefined,
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
	barcode: "00021130493609",
	name: "Roasted Onion & Garlic Pasta Sauce",
	nameProvenance: "source",
	brandOwner: "Signature Select",
	servingLabel: "125g",
	servingWeightGrams: 125,
	hasSourceServing: true,
	nutrients: [{
		nutrientId: 1079,
		nutrientName: "Fiber, total dietary",
		nutrientNumber: "291",
		unitName: "G",
		value: 2,
		source: source === "usda" ? "usda" : "open-food-facts",
		confidence: "unknown",
	}],
	reportedNutrientIds: [1079],
	categories: ["Pasta sauces"],
	image,
	source,
	sourceLabel:
		source === "usda" ? "USDA FoodData Central" : "Open Food Facts",
	sourceReference: source === "usda" ? "2658692" : "021130493609",
	fieldProvenance: {
		nutrition: {
			source: source === "usda" ? "usda" : "open-food-facts",
			confidence: "unknown",
		},
		categories: {
			source: source === "usda" ? "usda" : "open-food-facts",
			confidence: "unknown",
		},
		serving: {
			source: source === "usda" ? "usda" : "open-food-facts",
			confidence: "unknown",
		},
		...(image
			? {
				image: {
					source: image.source,
					sourceReference: image.sourceReference,
					confidence: image.confidence,
				},
			}
			: {}),
	},
	...overrides,
});

const openFoodFactsImage = {
	source: "open-food-facts" as const,
	sourceReference: "021130493609",
	role: "front" as const,
	imageUrl:
		"https://images.openfoodfacts.org/images/products/002/113/049/3609/front_en.5.400.jpg",
	licenseName: "Creative Commons Attribution-ShareAlike",
	confidence: "imported" as const,
};

const cachedCommunityImage = {
	...openFoodFactsImage,
	source: "community-reviewed" as const,
	sourceReference: "approved/00021130493609/front.jpg",
	imageUrl: "https://example.com/approved/front.jpg",
	confidence: "moderator-reviewed" as const,
};

describe("external barcode product lookup", () => {
	const getProductReferenceCatalog = vi
		.fn<() => Promise<ProductReferenceCatalog>>()
		.mockResolvedValue({} as ProductReferenceCatalog);

	it("disables runtime provider calls for the isolated test database", async () => {
		const getDisabledProductReferenceCatalog = vi.fn();

		const result = await lookupExternalBarcodeProduct("00021130493609", {
			externalLookupsEnabled: false,
			getProductReferenceCatalog: getDisabledProductReferenceCatalog,
		});

		expect(result).toBeNull();
		expect(getDisabledProductReferenceCatalog).not.toHaveBeenCalled();
		expect(areExternalProductLookupsEnabled("test")).toBe(false);
		expect(areExternalProductLookupsEnabled("production")).toBe(true);
	});

	it("keeps USDA nutrition while adding an available trusted source image", async () => {
		const usdaDraft = makeDraft("usda");
		const openFoodFacts = vi
			.fn()
			.mockResolvedValue(makeDraft("open-food-facts", openFoodFactsImage));

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getProductReferenceCatalog,
		});

		expect(result).toMatchObject({
			source: "usda",
			sourceReference: "2658692",
			image: openFoodFactsImage,
		});
		expect(openFoodFacts).toHaveBeenCalledOnce();
	});

	it("requests a supplement when a required nutrient is missing", async () => {
		const usdaDraft = makeDraft("usda");
		const openFoodFacts = vi.fn().mockResolvedValue(makeDraft(
			"open-food-facts",
			undefined,
			{
				nutrients: [{
					nutrientId: 1003,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: 1,
					source: "open-food-facts",
					confidence: "unknown",
				}],
				reportedNutrientIds: [1003],
			},
		));

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getProductReferenceCatalog,
			requiredNutrientIds: [1079, 1003],
		});

		expect(openFoodFacts).toHaveBeenCalledOnce();
		expect(result?.nutrients.map((item) => item.nutrientId)).toEqual([
			1079,
			1003,
		]);
	});

	it("keeps a cached image while checking the secondary source for other fields", async () => {
		const usdaDraft = makeDraft("usda");
		const openFoodFacts = vi.fn();

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getProductReferenceCatalog,
			cachedImage: Promise.resolve(cachedCommunityImage),
		});

		expect(result).toMatchObject({
			source: "usda",
			image: cachedCommunityImage,
		});
		expect(openFoodFacts).toHaveBeenCalledOnce();
	});

	it("uses a cached image with Open Food Facts nutrition when USDA has no match", async () => {
		const openFoodFactsDraft = makeDraft("open-food-facts", openFoodFactsImage);

		const result = await lookupExternalBarcodeProduct(
			openFoodFactsDraft.barcode,
			{
				usda: vi.fn().mockResolvedValue(null),
				openFoodFacts: vi.fn().mockResolvedValue(openFoodFactsDraft),
				getProductReferenceCatalog,
				cachedImage: Promise.resolve(cachedCommunityImage),
			},
		);

		expect(result).toMatchObject({
			source: "open-food-facts",
			image: cachedCommunityImage,
		});
	});

	it("does not replace a USDA match when the image source is missing", async () => {
		const usdaDraft = makeDraft("usda");

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts: vi.fn().mockResolvedValue(makeDraft("open-food-facts")),
			getProductReferenceCatalog,
		});

		expect(result).toBe(usdaDraft);
	});

	it("returns the USDA match when the optional image lookup fails", async () => {
		const usdaDraft = makeDraft("usda");

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts: vi.fn().mockRejectedValue(new Error("Image source unavailable")),
			getProductReferenceCatalog,
		});

		expect(result).toBe(usdaDraft);
	});

	it("continues when the optional image cache cannot be read", async () => {
		const usdaDraft = makeDraft("usda");
		const openFoodFacts = vi
			.fn()
			.mockResolvedValue(makeDraft("open-food-facts", openFoodFactsImage));

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getProductReferenceCatalog,
			cachedImage: Promise.reject(new Error("Image cache unavailable")),
		});

		expect(result?.image).toEqual(openFoodFactsImage);
		expect(openFoodFacts).toHaveBeenCalledOnce();
	});

	it("skips the secondary lookup when every enrichable field is already present", async () => {
		const usdaDraft = makeDraft("usda", openFoodFactsImage, {
			ingredients: "Tomatoes, onions",
			ingredientList: ["Tomatoes", "onions"],
			allergens: ["None declared"],
			traces: ["None declared"],
			dietaryTags: ["Vegan"],
			labels: ["Packaged food"],
			structuredIngredients: [{ id: "tomato", text: "Tomatoes" }],
			ingredientAnalysis: {
				ingredientTags: ["tomato", "onion"],
				analysisTags: ["vegan"],
				derivedTraceTags: [],
			},
			additives: ["e330"],
			packageQuantity: { label: "24 oz", amount: 24, unit: "oz" },
			sourceMetadata: { language: "en", revision: 4 },
			fieldProvenance: {
				precautionaryStatements: {
					source: "usda",
					sourceReference: "2658692",
					confidence: "unknown",
				},
			},
		});
		const openFoodFacts = vi.fn();

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getProductReferenceCatalog,
		});

		expect(result).toBe(usdaDraft);
		expect(openFoodFacts).not.toHaveBeenCalled();
	});

	it("still fills a missing category when the image already came from the DB", async () => {
		const usdaDraft = makeDraft("usda", undefined, {
			categories: [],
			fieldProvenance: {
				nutrition: { source: "usda", confidence: "unknown" },
				serving: { source: "usda", confidence: "unknown" },
			},
		});
		const openFoodFacts = vi
			.fn()
			.mockResolvedValue(makeDraft("open-food-facts", openFoodFactsImage));

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getProductReferenceCatalog,
			cachedImage: cachedCommunityImage,
		});

		expect(openFoodFacts).toHaveBeenCalledOnce();
		expect(result).toMatchObject({
			source: "usda",
			categories: ["Pasta sauces"],
			image: cachedCommunityImage,
			fieldProvenance: {
				nutrition: { source: "usda" },
				categories: { source: "open-food-facts" },
				image: { source: "community-reviewed" },
			},
		});
	});

	it("uses Open Food Facts when USDA is unavailable", async () => {
		const openFoodFactsDraft = makeDraft("open-food-facts", openFoodFactsImage, {
			barcode: "03017620422003",
			name: "Nutella",
			sourceReference: "03017620422003",
			nutrients: [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 539,
					source: "open-food-facts",
					sourceReference: "03017620422003",
					confidence: "unknown",
				},
			],
			reportedNutrientIds: [1008],
		});
		const usda = vi.fn().mockRejectedValue(new Error("USDA unavailable"));
		const openFoodFacts = vi.fn().mockResolvedValue(openFoodFactsDraft);

		const result = await lookupExternalBarcodeProduct(
			openFoodFactsDraft.barcode,
			{
				usda,
				openFoodFacts,
				getProductReferenceCatalog,
			},
		);

		expect(result).toEqual(openFoodFactsDraft);
		expect(result).toMatchObject({
			barcode: "03017620422003",
			name: "Nutella",
			source: "open-food-facts",
			sourceReference: "03017620422003",
			reportedNutrientIds: [1008],
		});
		expect(result?.nutrients).toHaveLength(1);
		expect(usda).toHaveBeenCalledOnce();
		expect(openFoodFacts).toHaveBeenCalledOnce();
	});

	it("uses COLA Cloud only after USDA and Open Food Facts have no match", async () => {
		const providerOrder: string[] = [];
		const colaCloudDraft = makeDraft("cola-cloud", undefined, {
			name: "Hard Lemonade",
			brandOwner: "Trillium",
			nutrients: [],
			reportedNutrientIds: [],
			alcoholByVolume: {
				percent: 6.5,
				valueStatus: "reported",
				basis: "volume-percent",
				sourceUnit: "% ABV",
			},
			regulatoryDisclosure: {
				profileKey: "us-ttb-alcohol-beverage-v1",
				evidenceStatus: "source-reported",
			},
			sourceLabel: "COLA Cloud",
			sourceReference: "26188001000045",
		});

		const result = await lookupExternalBarcodeProduct(colaCloudDraft.barcode, {
			usda: vi.fn(async () => {
				providerOrder.push("usda");
				return null;
			}),
			openFoodFacts: vi.fn(async () => {
				providerOrder.push("open-food-facts");
				return null;
			}),
			colaCloud: vi.fn(async () => {
				providerOrder.push("cola-cloud");
				return colaCloudDraft;
			}),
			getProductReferenceCatalog,
		});

		expect(result).toEqual(colaCloudDraft);
		expect(providerOrder).toEqual([
			"usda",
			"open-food-facts",
			"cola-cloud",
		]);
	});

	it("does not spend COLA Cloud quota when an existing provider matches", async () => {
		const openFoodFactsDraft = makeDraft("open-food-facts");
		const colaCloud = vi.fn();

		const result = await lookupExternalBarcodeProduct(openFoodFactsDraft.barcode, {
			usda: vi.fn().mockResolvedValue(null),
			openFoodFacts: vi.fn().mockResolvedValue(openFoodFactsDraft),
			colaCloud,
			getProductReferenceCatalog,
		});

		expect(result).toEqual(openFoodFactsDraft);
		expect(colaCloud).not.toHaveBeenCalled();
	});
});
