import { afterEach, describe, expect, it } from "vitest";
import {
	getFoodCompatibilityEvaluationMessage,
	getRegulatedAlcoholMissingSafetyDetailsMessage,
} from "$lib/utils/food/quality/foodCompatibilityEvaluationMessages";
import { configureNutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import type {
	FoodCompatibilityEvaluation,
	FoodCompatibilityEvaluationStatus,
} from "$lib/utils/food/quality/compatibility";
import type { FoodItem } from "$lib/utils/food/types";

const regulatedAlcoholDisclosureProfile = {
	key: "test-alcohol-label",
	displayName: "Alcohol beverage label",
	userDescription: "Test profile",
	disclosureKind: "regulated-alcohol" as const,
	nutritionEvaluationMode: "sparse-accepted" as const,
	nutritionProfileKey: null,
	regionCode: "US",
	authorityName: "Test authority",
	requiresAlcoholByVolume: true,
	requiresModeratorReview: true,
	userSelectable: true,
	sourceReference: "https://example.com/alcohol-labeling",
	sortOrder: 1,
	isDefault: false,
};

const createEvaluation = (
	status: FoodCompatibilityEvaluationStatus = "incomplete",
): FoodCompatibilityEvaluation => ({
	version: 1,
	status,
	policyVersion: 3,
	profileApplied: true,
	conflictCount: 0,
	coverage: {
		basis: "packaged-label",
		identity: "not_required",
		ingredients: "available",
		allergens: "available",
		traces: "available",
		policy: "available",
	},
	regulatoryContext: {
		status: "not_selected",
		requestedRegionCode: null,
		selectionSource: null,
		profile: null,
		coveredPreferences: [],
		uncoveredPreferences: [],
	},
	preferenceResolution: {
		resolvedCount: 0,
		resolvedPreferences: [],
		unresolvedPreferences: [],
	},
});

afterEach(() => configureNutritionCompletenessCatalog({ profiles: [] }));

describe("food compatibility evaluation messages", () => {
	it("names only the exact missing package evidence", () => {
		const evaluation = createEvaluation();
		evaluation.coverage.allergens = "missing";

		expect(getFoodCompatibilityEvaluationMessage(evaluation).message).toContain(
			"The allergen declaration is missing.",
		);
		expect(
			getFoodCompatibilityEvaluationMessage(evaluation).message,
		).not.toMatch(/ingredient list|cross-contact statement/);
	});

	it("formats multiple missing fields without including available or unnecessary evidence", () => {
		const evaluation = createEvaluation();
		evaluation.coverage.identity = "not_required";
		evaluation.coverage.ingredients = "missing";
		evaluation.coverage.allergens = "available";
		evaluation.coverage.traces = "missing";

		const message = getFoodCompatibilityEvaluationMessage(evaluation).message;
		expect(message).toContain(
			"The ingredient list and cross-contact statement are missing.",
		);
		expect(message).not.toMatch(/product identity|allergen declaration/);
	});

	it("separates a missing product identity from uncovered food-setting policy", () => {
		const evaluation = createEvaluation();
		evaluation.coverage.identity = "missing";
		evaluation.coverage.policy = "missing";
		evaluation.preferenceResolution.unresolvedPreferences = [
			{ label: "Banana", type: "allergen" },
			{ label: "Peanut", type: "allergen" },
		];

		expect(getFoodCompatibilityEvaluationMessage(evaluation).message).toContain(
			"The product identity is missing. An exact reviewed food-check rule is unavailable for Banana and Peanut.",
		);
	});

	it("describes missing policy coverage without inventing an affected setting", () => {
		const evaluation = createEvaluation();
		evaluation.coverage.policy = "missing";

		expect(getFoodCompatibilityEvaluationMessage(evaluation).message).toContain(
			"An exact reviewed food-check rule is unavailable for one or more saved food settings.",
		);
	});

	it("uses a precise defensive fallback for an inconsistent incomplete result", () => {
		const evaluation = createEvaluation();

		expect(getFoodCompatibilityEvaluationMessage(evaluation).message).toContain(
			"The stored food-check result is incomplete.",
		);
		expect(
			getFoodCompatibilityEvaluationMessage(evaluation).message,
		).not.toMatch(/might|ingredient, allergen, or cross-contact/);
	});

	it("names only missing package evidence in regulated-alcohol warnings", () => {
		configureNutritionCompletenessCatalog({
			profiles: [],
			regulatoryDisclosureProfiles: [regulatedAlcoholDisclosureProfile],
		});
		const food = {
			fdcId: 1,
			description: "Test drink",
			foodNutrients: [],
			foodIdentityType: "packaged",
			regulatoryDisclosure: {
				profileKey: "test-alcohol-label",
				evidenceStatus: "source-reported",
			},
			compatibilityEvaluation: {
				...createEvaluation("not_checked"),
				coverage: {
					...createEvaluation().coverage,
					ingredients: "available",
					allergens: "missing",
					traces: "available",
				},
			},
		} satisfies FoodItem;

		const message =
			getRegulatedAlcoholMissingSafetyDetailsMessage(food)?.message;
		expect(message).toContain("The allergen declaration is missing.");
		expect(message).not.toMatch(/ingredient list|cross-contact statement/);
	});
});
