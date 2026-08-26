import { describe, expect, it } from "vitest";
import {
	getBarcodeDraftState,
	getBarcodeImportMessage,
	getManualBarcodeReferenceResult,
} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const makeSparseDraft = (
	overrides: Partial<BarcodeProductDraft>,
): BarcodeProductDraft => ({
	barcode: "850027056715",
	name: "Straightaway Espresso Martini",
	nameProvenance: "source",
	brandOwner: "Straightaway",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: false,
	nutrients: [],
	reportedNutrientIds: [],
	categories: [],
	source: "cola-cloud",
	sourceLabel: "COLA Cloud",
	sourceReference: "24134001000441",
	...overrides,
});

describe("sparse alcohol barcode form state", () => {
	it("preserves exact recall notices when product details are unavailable", () => {
		const result = getManualBarcodeReferenceResult({
			lookup: {
				status: "not-found",
				barcode: "00860014523120",
				safetyCheck: {
					status: "checked",
					alerts: [
						{
							id: "recall-1",
							providerKey: "fda-recalls",
							sourceName: "FDA Recalls",
							sourceAttribution: "U.S. Food and Drug Administration",
							alertType: "recall",
							status: "ongoing",
							productDescription: "Everything Sprouts Alfalfa Sprouts",
							reason: "Potential Salmonella and E. coli contamination.",
							sourceUrl: "https://www.fda.gov/example-recall",
							matchType: "exact_gtin",
							requiresPackageCheck: true,
							detectedAt: "2026-08-25T00:00:00.000Z",
						},
					],
				},
			},
			referenceKey: "00860014523120",
			normalizedName: "",
		});

		expect(result.status).toBe("not-found");
		expect(result.safetyAlerts).toHaveLength(1);
		expect(result.safetyAlerts[0]?.matchType).toBe("exact_gtin");
	});

	it("keeps the technical 100g basis out of the package-serving UI", () => {
		const draft = makeSparseDraft({
			alcoholByVolume: {
				percent: 20,
				valueStatus: "reported",
				basis: "volume-percent",
				sourceUnit: "% ABV",
			},
			regulatoryDisclosure: {
				profileKey: "us-ttb-alcohol-beverage-v1",
				evidenceStatus: "source-reported",
			},
		});

		expect(getBarcodeDraftState(draft)).toMatchObject({
			barcode: "850027056715",
			servingLabel: "",
			servingWeightGrams: 100,
			usesInternal100GramBasis: true,
			alcoholByVolume: { percent: 20 },
		});
		expect(getBarcodeImportMessage(draft, 0, "scan")).toContain(
			"did not report nutrition values",
		);
		expect(getBarcodeImportMessage(draft, 0, "scan")).toContain(
			"No package serving weight was reported",
		);
	});

	it("preserves reported zeros without inventing the remaining nutrition", () => {
		const draft = makeSparseDraft({
			barcode: "851017006055",
			name: "Buoy Beer",
			source: "open-food-facts",
			sourceLabel: "Open Food Facts",
			sourceReference: "851017006055",
			nutrients: [
				{
					nutrientId: 1258,
					nutrientName: "Fatty acids, total saturated",
					nutrientNumber: "606",
					unitName: "g",
					value: 0,
					valueStatus: "reported-zero",
				},
				{
					nutrientId: 2000,
					nutrientName: "Total Sugars",
					nutrientNumber: "269",
					unitName: "g",
					value: 0,
					valueStatus: "reported-zero",
				},
			],
			reportedNutrientIds: [1258, 2000],
		});

		const state = getBarcodeDraftState(draft);
		expect(state.manualNutrientValues).toEqual({ 1258: 0, 2000: 0 });
		expect(state.importedNutrients).toHaveLength(2);
		expect(getBarcodeImportMessage(draft, 0, "autofill")).toContain(
			"2 nutrition values were reported",
		);
		expect(getBarcodeImportMessage(draft, 0, "autofill")).toContain(
			"Missing values remain unknown",
		);
	});
});
