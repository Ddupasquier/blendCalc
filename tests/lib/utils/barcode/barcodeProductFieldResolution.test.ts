import { describe, expect, it } from "vitest";
import { resolveBarcodeProductFields } from "$lib/utils/barcode/barcodeProductFieldResolution";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { FoodNutrient } from "$lib/utils/food/types";
import { PRODUCT_RESOLUTION_POLICY_FIXTURE } from "../../../fixtures/productResolutionPolicy";

const createDraft = (
	source: "usda" | "open-food-facts",
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
	barcode: "00012345678905",
	name:
		source === "usda" ? "Reviewed source name" : "Longer imported source name",
	nameProvenance: "source",
	brandOwner: "Example brand",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: true,
	nutrients: [],
	reportedNutrientIds: [],
	source,
	sourceLabel: source,
	sourceReference: source,
	fieldProvenance: {
		productName: {
			source,
			sourceReference: source,
			confidence: source === "usda" ? "source-verified" : "imported",
		},
		brandOwner: {
			source,
			sourceReference: source,
			confidence: source === "usda" ? "source-verified" : "imported",
		},
		serving: {
			source,
			sourceReference: source,
			confidence: source === "usda" ? "source-verified" : "imported",
		},
	},
	...overrides,
});

const createSugarNutrient = (
	nutrientId: 1235 | 2000,
	value: number,
	source: "usda" | "open-food-facts",
): FoodNutrient => ({
	nutrientId,
	nutrientName: nutrientId === 2000 ? "Total sugars" : "Added sugars",
	nutrientNumber: String(nutrientId),
	unitName: "G",
	value,
	valueOrigin: "reported",
	source,
	sourceReference: source,
	confidence: source === "usda" ? "source-verified" : "imported",
});

describe("barcode product field resolution", () => {
	it("uses reviewed confidence ranks before field completeness", () => {
		const resolved = resolveBarcodeProductFields(
			[
				createDraft("open-food-facts", {
					name: "A substantially longer imported product name",
				}),
				createDraft("usda"),
			],
			PRODUCT_RESOLUTION_POLICY_FIXTURE,
		);

		expect(resolved?.name).toBe("Reviewed source name");
		expect(resolved?.fieldProvenance?.productName).toMatchObject({
			source: "usda",
			confidence: "source-verified",
		});
	});

	it("fails closed when a required scoring metric is not configured", () => {
		const scoringWeights = new Map(
			PRODUCT_RESOLUTION_POLICY_FIXTURE.scoringWeights,
		);
		scoringWeights.delete("field:brandOwner");

		expect(() =>
			resolveBarcodeProductFields([createDraft("usda")], {
				...PRODUCT_RESOLUTION_POLICY_FIXTURE,
				scoringWeights,
			}),
		).toThrow("field:brandOwner:text-character");
	});

	it("does not combine independently preferred nutrients into an impossible set", () => {
		const resolved = resolveBarcodeProductFields(
			[
				createDraft("usda", {
					nutrients: [createSugarNutrient(2000, 2, "usda")],
					reportedNutrientIds: [2000],
					fieldProvenance: {
						nutrition: {
							source: "usda",
							sourceReference: "usda",
							confidence: "source-verified",
						},
					},
				}),
				createDraft("open-food-facts", {
					nutrients: [
						createSugarNutrient(2000, 5, "open-food-facts"),
						createSugarNutrient(1235, 5, "open-food-facts"),
					],
					reportedNutrientIds: [2000, 1235],
					fieldProvenance: {
						nutrition: {
							source: "open-food-facts",
							sourceReference: "open-food-facts",
							confidence: "imported",
						},
					},
				}),
			],
			PRODUCT_RESOLUTION_POLICY_FIXTURE,
		);

		expect(resolved?.nutrients).toEqual([
			expect.objectContaining({ nutrientId: 2000, value: 2 }),
		]);
		expect(resolved?.reportedNutrientIds).toEqual([2000]);
	});

	it("suppresses an impossible child nutrient from a single exact provider result", () => {
		const resolved = resolveBarcodeProductFields(
			[
				createDraft("open-food-facts", {
					barcode: "00034000003129",
					name: "Hershey's Syrup",
					servingWeightGrams: 19,
					nutrients: [
						createSugarNutrient(2000, 10, "open-food-facts"),
						createSugarNutrient(1235, 14.4, "open-food-facts"),
					],
					reportedNutrientIds: [2000, 1235],
					fieldProvenance: {
						nutrition: {
							source: "open-food-facts",
							sourceReference: "00034000003129",
							confidence: "imported",
						},
					},
				}),
			],
			PRODUCT_RESOLUTION_POLICY_FIXTURE,
		);

		expect(resolved?.nutrients).toEqual([
			expect.objectContaining({ nutrientId: 2000, value: 10 }),
		]);
		expect(resolved?.reportedNutrientIds).toEqual([2000]);
	});
});
