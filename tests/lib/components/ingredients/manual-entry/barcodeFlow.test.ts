import { describe, expect, it } from "vitest";
import {
	getBarcodeDraftState,
	getBarcodeImportMessage,
	getManualBarcodeReferenceResult,
} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";

const nutrientField = (
	nutrientId: number,
	step: "macros" | "extended",
): ManualEntryNutrientDefinition => ({
	dedupeKey: `${step}:${nutrientId}`,
	nutrientId,
	nutrientName: `Nutrient ${nutrientId}`,
	nutrientNumber: String(nutrientId),
	unitName: "G",
	nutrientType: null,
	step,
	group: step === "macros" ? "Macros" : "Vitamins",
	groupSort: 10,
	sort: nutrientId,
	label: `Nutrient ${nutrientId}`,
	requiredForManualEntry: false,
});

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
		expect(getBarcodeImportMessage(draft, [], "scan")).toContain(
			"No nutrition values from this source could be accepted and retained",
		);
		expect(getBarcodeImportMessage(draft, [], "scan")).toContain(
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
		const message = getBarcodeImportMessage(
			draft,
			[nutrientField(1258, "macros"), nutrientField(2000, "macros")],
			"autofill",
		);
		expect(message).toContain(
			"2 nutrition values were accepted and retained from the source",
		);
		expect(message).toContain("Review 2 in Macros");
		expect(message).not.toContain("vitamin or mineral");
		expect(message).toContain("Missing values remain unknown");
	});

	it("reports the exact Manual Entry locations for the investigated UPC", () => {
		const macroIds = [
			1008, 1003, 1004, 1005, 1079, 2000, 1235, 1093, 1258, 1257, 1293, 1292,
			1253,
		];
		const extendedIds = [1087, 1089, 1092, 1114];
		const draft = makeSparseDraft({
			barcode: "00030000581728",
			nutrients: [...macroIds, ...extendedIds].map((nutrientId) => ({
				nutrientId,
				nutrientName: `Nutrient ${nutrientId}`,
				nutrientNumber: String(nutrientId),
				unitName: "G",
				value: nutrientId === 1114 ? 0 : 1,
			})),
			reportedNutrientIds: [...macroIds, ...extendedIds],
		});

		const message = getBarcodeImportMessage(
			draft,
			[
				...macroIds.map((id) => nutrientField(id, "macros")),
				...extendedIds.map((id) => nutrientField(id, "extended")),
			],
			"autofill",
		);

		expect(message).toContain(
			"17 nutrition values were accepted and retained from the source",
		);
		expect(message).toContain("Review 13 in Macros and 4 in Extended");
		expect(message).not.toContain("additional vitamin or mineral");
	});

	it("calls out accepted values without an editable field", () => {
		const draft = makeSparseDraft({
			nutrients: [
				{
					nutrientId: 9999,
					nutrientName: "Reviewed nutrient",
					nutrientNumber: "9999",
					unitName: "G",
					value: 1,
				},
			],
			reportedNutrientIds: [9999],
		});

		expect(getBarcodeImportMessage(draft, [], "scan")).toContain(
			"1 accepted and retained value does not yet have an editable Manual Entry field",
		);
	});

	it("carries mapping-review evidence into the form and explains that it is excluded from math", () => {
		const draft = makeSparseDraft({
			nutrientSourceReview: [
				{
					nutrientName: "Example nutrient",
					unitName: "mg",
					amount: 4,
					measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
					valueStatus: "reported",
					mappingStatus: "unmapped",
					sourceNutrientKey: "example-nutrient",
				},
			],
		});

		const state = getBarcodeDraftState(draft);
		expect(state.nutrientSourceReview).toHaveLength(1);
		expect(getBarcodeImportMessage(draft, [], "autofill")).toContain(
			"1 additional source value needs mapping review and is not used in nutrition calculations",
		);
	});
});
