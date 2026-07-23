import { describe, expect, it, vi } from "vitest";
import { lookupExternalBarcodeProduct } from "$lib/server/products/externalProduct.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";

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
	const getReferenceData = vi
		.fn<() => Promise<ProductReferenceData>>()
		.mockResolvedValue({} as ProductReferenceData);

	it("keeps USDA nutrition while adding an available trusted source image", async () => {
		const usdaDraft = makeDraft("usda");
		const openFoodFacts = vi
			.fn()
			.mockResolvedValue(makeDraft("open-food-facts", openFoodFactsImage));

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getReferenceData,
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
			getReferenceData,
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
			getReferenceData,
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
				getReferenceData,
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
			getReferenceData,
		});

		expect(result).toBe(usdaDraft);
	});

	it("returns the USDA match when the optional image lookup fails", async () => {
		const usdaDraft = makeDraft("usda");

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts: vi.fn().mockRejectedValue(new Error("Image source unavailable")),
			getReferenceData,
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
			getReferenceData,
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
		});
		const openFoodFacts = vi.fn();

		const result = await lookupExternalBarcodeProduct(usdaDraft.barcode, {
			usda: vi.fn().mockResolvedValue(usdaDraft),
			openFoodFacts,
			getReferenceData,
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
			getReferenceData,
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
		const openFoodFactsDraft = makeDraft(
			"open-food-facts",
			openFoodFactsImage,
		);

		const result = await lookupExternalBarcodeProduct(
			openFoodFactsDraft.barcode,
			{
				usda: vi.fn().mockRejectedValue(new Error("USDA unavailable")),
				openFoodFacts: vi.fn().mockResolvedValue(openFoodFactsDraft),
				getReferenceData,
			},
		);

		expect(result).toEqual(openFoodFactsDraft);
	});
});
