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
		confidence: source === "usda" ? "source-verified" : "imported",
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
			confidence: source === "usda" ? "source-verified" : "imported",
		},
		categories: {
			source: source === "usda" ? "usda" : "open-food-facts",
			confidence: source === "usda" ? "source-verified" : "imported",
		},
		serving: {
			source: source === "usda" ? "usda" : "open-food-facts",
			confidence: source === "usda" ? "source-verified" : "imported",
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

	it("uses a cached image before requesting another image source", async () => {
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
		expect(openFoodFacts).not.toHaveBeenCalled();
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

	it("skips the secondary lookup when the primary draft already has an image", async () => {
		const usdaDraft = makeDraft("usda", openFoodFactsImage);
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
				nutrition: { source: "usda", confidence: "source-verified" },
				serving: { source: "usda", confidence: "source-verified" },
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
