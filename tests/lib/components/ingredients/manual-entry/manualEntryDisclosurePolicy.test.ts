import { describe, expect, it } from "vitest";
import {
	getManualEntryDisclosurePolicy,
	getManualEntryNutrientGroupBadge,
	getManualEntryNutritionFieldPolicy,
	getManualEntryNutritionStepHelper,
} from "$lib/components/ingredients/manual-entry/utils/manualEntryDisclosurePolicy";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";

const profiles: ProductRegulatoryDisclosureProfile[] = [
	{
		key: "us-standard-nutrition-facts-v1",
		displayName: "Standard Nutrition Facts",
		userDescription: "Standard label",
		disclosureKind: "standard-nutrition",
		nutritionEvaluationMode: "profile",
		nutritionProfileKey: "us-packaged-label-v1",
		regionCode: "US",
		authorityName: "FDA",
		requiresAlcoholByVolume: false,
		requiresModeratorReview: false,
		userSelectable: true,
		sourceReference: "test",
		sortOrder: 10,
		isDefault: true,
	},
	{
		key: "us-ttb-alcohol-beverage-v1",
		displayName: "Alcohol beverage label",
		userDescription: "Sparse alcohol label",
		disclosureKind: "regulated-alcohol",
		nutritionEvaluationMode: "sparse-accepted",
		nutritionProfileKey: null,
		regionCode: "US",
		authorityName: "TTB",
		requiresAlcoholByVolume: true,
		requiresModeratorReview: true,
		userSelectable: true,
		sourceReference: "test",
		sortOrder: 20,
		isDefault: false,
	},
];

describe("manual-entry regulatory disclosure policy", () => {
	it("keeps standard nutrition and serving requirements for ordinary labels", () => {
		expect(
			getManualEntryDisclosurePolicy({
				profileKey: "us-standard-nutrition-facts-v1",
				profiles,
			}),
		).toMatchObject({
			requiresStandardNutrition: true,
			allowsMissingServingWeight: false,
			requiresAlcoholByVolume: false,
		});
	});

	it("accepts honest nutrition omissions while requiring ABV for alcohol labels", () => {
		expect(
			getManualEntryDisclosurePolicy({
				profileKey: "us-ttb-alcohol-beverage-v1",
				profiles,
			}),
		).toMatchObject({
			requiresStandardNutrition: false,
			allowsMissingServingWeight: true,
			requiresAlcoholByVolume: true,
		});
	});

	it("does not weaken requirements for an unknown profile key", () => {
		expect(
			getManualEntryDisclosurePolicy({
				profileKey: "unreviewed-profile",
				profiles,
			}),
		).toMatchObject({
			profile: null,
			requiresStandardNutrition: true,
			allowsMissingServingWeight: false,
		});
	});
});

describe("manual-entry nutrition field policy", () => {
	const standardPolicy = getManualEntryDisclosurePolicy({
		profileKey: "us-standard-nutrition-facts-v1",
		profiles,
	});
	const sparsePolicy = getManualEntryDisclosurePolicy({
		profileKey: "us-ttb-alcohol-beverage-v1",
		profiles,
	});

	it("requires core nutrition only when sharing a standard label", () => {
		expect(
			getManualEntryNutritionFieldPolicy({
				shareWithCatalog: true,
				usesInternal100GramBasis: false,
				disclosurePolicy: standardPolicy,
			}),
		).toEqual({
			requiresNutritionFields: true,
			helper:
				"To share this standard label, enter every value marked *. Leave a field blank when the label does not list it, and enter 0 only when the label reports zero.",
		});
	});

	it("explains that nutrition is optional for a private save", () => {
		const policy = getManualEntryNutritionFieldPolicy({
			shareWithCatalog: false,
			usesInternal100GramBasis: false,
			disclosurePolicy: standardPolicy,
		});

		expect(policy.requiresNutritionFields).toBe(false);
		expect(policy.helper).toContain("optional for a private save");
		expect(policy.helper).toContain("enter 0 only when the label reports zero");
	});

	it("keeps sparse imported values on their source basis without inventing zeroes", () => {
		const policy = getManualEntryNutritionFieldPolicy({
			shareWithCatalog: true,
			usesInternal100GramBasis: true,
			disclosurePolicy: sparsePolicy,
		});

		expect(policy.requiresNutritionFields).toBe(false);
		expect(policy.helper).toContain("reported per-100g basis");
		expect(policy.helper).toContain("Leave a field blank");
	});
});

describe("manual-entry barcode nutrient presentation", () => {
	const field = (
		nutrientId: number,
		requiredForManualEntry = false,
	): ManualEntryNutrientDefinition => ({
		dedupeKey: `test-${nutrientId}`,
		nutrientId,
		nutrientName: `Nutrient ${nutrientId}`,
		nutrientNumber: String(nutrientId),
		unitName: "g",
		nutrientType: null,
		step: "macros",
		group: "Test group",
		groupSort: 1,
		sort: 1,
		label: `Nutrient ${nutrientId} (g)`,
		requiredForManualEntry,
	});

	it("labels accepted source groups by what the barcode actually reported", () => {
		const group = { title: "Test group", fields: [field(1008), field(1003)] };
		const base = {
			group,
			hasAcceptedBarcodeSource: true,
			isRequired: () => false,
		};

		expect(
			getManualEntryNutrientGroupBadge({
				...base,
				reportedNutrientIds: [1008],
			}),
		).toBe("From barcode");
		expect(
			getManualEntryNutrientGroupBadge({
				...base,
				reportedNutrientIds: [],
			}),
		).toBe("Not provided");
	});

	it("keeps manual-only groups optional and marks real sharing requirements", () => {
		const optionalGroup = { title: "Optional", fields: [field(1008)] };
		const requiredGroup = { title: "Required", fields: [field(1003, true)] };
		const base = {
			hasAcceptedBarcodeSource: false,
			reportedNutrientIds: [],
		};

		expect(
			getManualEntryNutrientGroupBadge({
				...base,
				group: optionalGroup,
				isRequired: () => false,
			}),
		).toBe("Optional");
		expect(
			getManualEntryNutrientGroupBadge({
				...base,
				group: requiredGroup,
				isRequired: (candidate) => candidate.requiredForManualEntry,
			}),
		).toBe("Required to share");
	});

	it("replaces blanket optional guidance after barcode nutrients are accepted", () => {
		const fallback =
			"All fields on this step are optional. Fill what you know.";

		expect(
			getManualEntryNutritionStepHelper({
				hasAcceptedBarcodeNutrients: false,
				fallback,
			}),
		).toBe(fallback);
		expect(
			getManualEntryNutritionStepHelper({
				hasAcceptedBarcodeNutrients: true,
				fallback,
			}),
		).toContain("Values marked From barcode");
		expect(
			getManualEntryNutritionStepHelper({
				hasAcceptedBarcodeNutrients: true,
				fallback,
			}),
		).toContain("Not provided");
	});
});
