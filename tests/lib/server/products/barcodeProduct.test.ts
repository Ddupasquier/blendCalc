import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { PRODUCT_RESOLUTION_POLICY_FIXTURE } from "../../../fixtures/productResolutionPolicy";

const mocks = vi.hoisted(() => ({
	getSharedProductByBarcode: vi.fn(),
	lookupExternalBarcodeProduct: vi.fn(),
	getRequiredPackagedNutrientIds: vi.fn(),
	getProductReferenceCatalog: vi.fn(),
	getDefaultProductResolutionPolicy: vi.fn(),
	mapSharedCatalogFood: vi.fn(),
	getCachedFoodImageByBarcode: vi.fn(),
	resolveBarcodeDraftCategory: vi.fn(),
	persistSharedProductExternalEnrichment: vi.fn(),
}));

vi.mock("$lib/server/products/catalog.server", () => ({
	getSharedProductByBarcode: mocks.getSharedProductByBarcode,
}));
vi.mock("$lib/server/products/externalProduct.server", () => ({
	lookupExternalBarcodeProduct: mocks.lookupExternalBarcodeProduct,
	getRequiredPackagedNutrientIds: mocks.getRequiredPackagedNutrientIds,
}));
vi.mock("$lib/server/products/productReferenceCatalog.server", () => ({
	getProductReferenceCatalog: mocks.getProductReferenceCatalog,
}));
vi.mock("$lib/server/products/productResolutionPolicy.server", () => ({
	getDefaultProductResolutionPolicy: mocks.getDefaultProductResolutionPolicy,
}));
vi.mock("$lib/utils/barcode/barcodeProductMappers", () => ({
	mapSharedCatalogFood: mocks.mapSharedCatalogFood,
}));
vi.mock("$lib/utils/storage/supabase/foodImages", () => ({
	getCachedFoodImageByBarcode: mocks.getCachedFoodImageByBarcode,
}));
vi.mock("$lib/server/products/categoryMapping.server", () => ({
	resolveBarcodeDraftCategory: mocks.resolveBarcodeDraftCategory,
}));
vi.mock("$lib/server/products/catalogEnrichment.server", () => ({
	persistSharedProductExternalEnrichment:
		mocks.persistSharedProductExternalEnrichment,
}));

import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";

const makeDraft = (
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
	barcode: "00021130493609",
	name: "Roasted Onion & Garlic Pasta Sauce",
	nameProvenance: "source",
	brandOwner: "Signature Select",
	servingLabel: "125 g",
	servingWeightGrams: 125,
	hasSourceServing: true,
	nutrients: [
		{
			nutrientId: 1079,
			nutrientName: "Fiber, total dietary",
			nutrientNumber: "291",
			unitName: "G",
			value: 2,
			source: "usda",
		},
	],
	reportedNutrientIds: [1079],
	categories: ["Pasta sauces"],
	ingredients: "Tomato puree, onions, garlic",
	ingredientList: ["Tomato puree", "Onions", "Garlic"],
	structuredIngredients: [{ id: "tomato", text: "Tomato puree" }],
	ingredientAnalysis: {
		ingredientTags: ["tomato", "onion", "garlic"],
		analysisTags: ["vegetarian"],
		derivedTraceTags: [],
	},
	additives: ["e330"],
	allergens: ["milk"],
	traces: ["wheat"],
	precautionaryStatements: [
		{
			type: "may_contain",
			text: "May contain wheat.",
			allergens: ["wheat"],
			languageCode: "en",
			sourceField: "traces",
		},
	],
	dietaryTags: ["vegetarian"],
	labels: ["packaged food"],
	packageQuantity: { label: "24 oz", amount: 24, unit: "oz" },
	sourceMetadata: { language: "en", revision: 4 },
	image: {
		source: "open-food-facts",
		sourceReference: "00021130493609",
		role: "front",
		imageUrl: "https://images.openfoodfacts.org/product.jpg",
		licenseName: "CC BY-SA",
		confidence: "imported",
	},
	source: "shared-catalog",
	sourceLabel: "blendCalc verified catalog",
	sourceReference: "shared-product-id",
	...overrides,
});

describe("barcode product DB-first enrichment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getProductReferenceCatalog.mockResolvedValue({});
		mocks.getDefaultProductResolutionPolicy.mockResolvedValue(
			PRODUCT_RESOLUTION_POLICY_FIXTURE,
		);
		mocks.getRequiredPackagedNutrientIds.mockResolvedValue([1079]);
		mocks.getCachedFoodImageByBarcode.mockResolvedValue(null);
		mocks.resolveBarcodeDraftCategory.mockImplementation(
			async (_supabase, draft) => draft,
		);
		mocks.persistSharedProductExternalEnrichment.mockResolvedValue([]);
	});

	it("returns a complete DB product without calling an external API", async () => {
		const sharedDraft = makeDraft();
		mocks.getSharedProductByBarcode.mockResolvedValue({
			id: "shared-product-id",
		});
		mocks.mapSharedCatalogFood.mockReturnValue(sharedDraft);

		const result = await lookupBarcodeProductDraft(
			{} as never,
			sharedDraft.barcode,
		);

		expect(result).toBe(sharedDraft);
		expect(mocks.getSharedProductByBarcode).toHaveBeenCalledOnce();
		expect(mocks.lookupExternalBarcodeProduct).not.toHaveBeenCalled();
		expect(mocks.persistSharedProductExternalEnrichment).not.toHaveBeenCalled();
	});

	it("loads independent catalog references concurrently", async () => {
		const sharedDraft = makeDraft();
		let resolveReferenceCatalog!: (value: object) => void;
		let resolveRequiredNutrients!: (value: number[]) => void;
		mocks.getSharedProductByBarcode.mockResolvedValue({
			id: "shared-product-id",
		});
		mocks.mapSharedCatalogFood.mockReturnValue(sharedDraft);
		mocks.getProductReferenceCatalog.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReferenceCatalog = resolve;
			}),
		);
		mocks.getRequiredPackagedNutrientIds.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveRequiredNutrients = resolve;
			}),
		);

		const lookupPromise = lookupBarcodeProductDraft(
			{} as never,
			sharedDraft.barcode,
		);
		await vi.waitFor(() => {
			expect(mocks.getProductReferenceCatalog).toHaveBeenCalledOnce();
			expect(mocks.getRequiredPackagedNutrientIds).toHaveBeenCalledOnce();
		});

		resolveReferenceCatalog({});
		resolveRequiredNutrients([1079]);

		await expect(lookupPromise).resolves.toBe(sharedDraft);
	});

	it("uses APIs only to fill fields missing from the DB product", async () => {
		const sharedDraft = makeDraft({ categories: [], image: undefined });
		const supplement = makeDraft({
			source: "usda",
			sourceLabel: "USDA FoodData Central",
			sourceReference: "2658692",
			fieldProvenance: {
				categories: {
					source: "usda",
					sourceReference: "2658692",
					confidence: "imported",
				},
			},
		});
		mocks.getSharedProductByBarcode.mockResolvedValue({
			id: "shared-product-id",
		});
		mocks.mapSharedCatalogFood.mockReturnValue(sharedDraft);
		mocks.lookupExternalBarcodeProduct.mockResolvedValue(supplement);

		const result = await lookupBarcodeProductDraft(
			{} as never,
			sharedDraft.barcode,
		);

		expect(mocks.getSharedProductByBarcode).toHaveBeenCalledOnce();
		expect(mocks.lookupExternalBarcodeProduct).toHaveBeenCalledOnce();
		expect(
			mocks.getSharedProductByBarcode.mock.invocationCallOrder[0],
		).toBeLessThan(
			mocks.lookupExternalBarcodeProduct.mock.invocationCallOrder[0] ??
				Infinity,
		);
		expect(result).toMatchObject({
			source: "shared-catalog",
			categories: ["Pasta sauces"],
			image: supplement.image,
		});
		expect(mocks.persistSharedProductExternalEnrichment).toHaveBeenCalledWith(
			expect.objectContaining({
				sharedProductId: "shared-product-id",
				barcode: sharedDraft.barcode,
				fields: expect.arrayContaining(["image", "categories"]),
			}),
		);
	});

	it("uses the completed DB row on a repeated lookup without another provider request", async () => {
		const incompleteDraft = makeDraft({
			hasSourceServing: false,
			servingLabel: undefined,
			servingWeightGrams: undefined,
		});
		const completedDraft = makeDraft();
		const supplement = makeDraft({
			source: "usda",
			sourceLabel: "USDA FoodData Central",
			sourceReference: "2032704",
			fieldProvenance: {
				serving: {
					source: "usda",
					sourceReference: "2032704",
					confidence: "unknown",
				},
			},
		});

		mocks.getSharedProductByBarcode.mockResolvedValue({
			id: "shared-product-id",
		});
		mocks.mapSharedCatalogFood
			.mockReturnValueOnce(incompleteDraft)
			.mockReturnValueOnce(completedDraft);
		mocks.lookupExternalBarcodeProduct.mockResolvedValue(supplement);

		const firstResult = await lookupBarcodeProductDraft(
			{} as never,
			incompleteDraft.barcode,
		);
		const repeatedResult = await lookupBarcodeProductDraft(
			{} as never,
			incompleteDraft.barcode,
		);

		expect(firstResult).toMatchObject({
			hasSourceServing: true,
			servingWeightGrams: 125,
		});
		expect(repeatedResult).toBe(completedDraft);
		expect(mocks.lookupExternalBarcodeProduct).toHaveBeenCalledOnce();
		expect(mocks.persistSharedProductExternalEnrichment).toHaveBeenCalledOnce();
	});

	it("keeps a usable DB product when optional cache and API lookups fail", async () => {
		const sharedDraft = makeDraft({ categories: [], image: undefined });
		mocks.getSharedProductByBarcode.mockResolvedValue({
			id: "shared-product-id",
		});
		mocks.mapSharedCatalogFood.mockReturnValue(sharedDraft);
		mocks.getCachedFoodImageByBarcode.mockRejectedValue(
			new Error("Cache offline"),
		);
		mocks.lookupExternalBarcodeProduct.mockRejectedValue(
			new Error("APIs offline"),
		);

		const result = await lookupBarcodeProductDraft(
			{} as never,
			sharedDraft.barcode,
		);

		expect(result).toBe(sharedDraft);
		expect(mocks.persistSharedProductExternalEnrichment).not.toHaveBeenCalled();
	});
});
