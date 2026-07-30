import { describe, expect, it } from "vitest";
import {
	getFoodCompatibilityEvaluation,
	getFoodCompatibilityEvidenceCoverage,
} from "$lib/utils/food/quality/foodCompatibilityEvaluation";
import {
	getFoodCompatibilityEvaluationMessage,
} from "$lib/utils/food/quality/foodCompatibilityEvaluationMessages";
import type { FdcFood } from "$lib/utils/food/types";

const makeFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Example food",
	foodNutrients: [],
	foodIdentityType: "packaged",
	...overrides,
});

const completePackagedFood = makeFood({
	ingredients: "Water, salt",
	fieldProvenance: {
		ingredients: { source: "manufacturer" },
		allergens: { source: "manufacturer" },
		traces: { source: "manufacturer" },
	},
});

describe("food compatibility evaluation", () => {
	it("does not check a food when no personal preference is active", () => {
		expect(getFoodCompatibilityEvaluation({
			food: completePackagedFood,
			policyVersion: 4,
			hasActivePreferences: false,
			policyCoversPreferences: true,
			conflictCount: 0,
		})).toMatchObject({
			status: "not_checked",
			profileApplied: false,
			policyVersion: 4,
		});
	});

	it("requires ingredients, allergen declarations, and trace declarations for packaged food", () => {
		const incomplete = getFoodCompatibilityEvaluation({
			food: makeFood({
				ingredients: "Water, salt",
				allergens: ["Milk"],
			}),
			policyVersion: 4,
			hasActivePreferences: true,
			policyCoversPreferences: true,
			conflictCount: 0,
		});

		expect(incomplete.status).toBe("incomplete");
		expect(incomplete.coverage).toMatchObject({
			ingredients: "available",
			allergens: "available",
			traces: "missing",
		});
	});

	it("marks a complete non-conflicting packaged evaluation as checked", () => {
		const evaluation = getFoodCompatibilityEvaluation({
			food: completePackagedFood,
			policyVersion: 4,
			hasActivePreferences: true,
			policyCoversPreferences: true,
			conflictCount: 0,
		});

		expect(evaluation.status).toBe("checked");
		expect(getFoodCompatibilityEvaluationMessage(evaluation)).toMatchObject({
			title: "No conflict found in available information",
		});
		expect(getFoodCompatibilityEvaluationMessage(evaluation).message)
			.not.toMatch(/\bsafe\b|allergen-free/i);
	});

	it("prioritizes a detected conflict over incomplete evidence", () => {
		expect(getFoodCompatibilityEvaluation({
			food: makeFood({ ingredients: "Milk" }),
			policyVersion: 4,
			hasActivePreferences: true,
			policyCoversPreferences: true,
			conflictCount: 1,
		})).toMatchObject({
			status: "conflict",
			conflictCount: 1,
		});
	});

	it("uses authoritative generic identity instead of package-label requirements", () => {
		const food = makeFood({
			description: "Spinach, raw",
			foodIdentityType: "generic",
			dataType: "Foundation",
		});

		expect(getFoodCompatibilityEvidenceCoverage(food)).toMatchObject({
			basis: "generic-taxonomy",
			identity: "available",
			ingredients: "not_required",
			allergens: "not_required",
			traces: "not_required",
		});
		expect(getFoodCompatibilityEvaluation({
			food,
			policyVersion: 4,
			hasActivePreferences: true,
			policyCoversPreferences: true,
			conflictCount: 0,
		}).status).toBe("checked");
	});

	it("keeps uncovered custom preferences incomplete", () => {
		expect(getFoodCompatibilityEvaluation({
			food: completePackagedFood,
			policyVersion: 4,
			hasActivePreferences: true,
			policyCoversPreferences: false,
			conflictCount: 0,
		})).toMatchObject({
			status: "incomplete",
			coverage: { policy: "missing" },
		});
	});
});
