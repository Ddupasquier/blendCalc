import { describe, expect, it } from "vitest";
import { resolveBarcodeProductFields } from "$lib/utils/barcode/barcodeProductFieldResolution";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
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
});
