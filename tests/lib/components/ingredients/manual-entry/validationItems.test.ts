import { describe, expect, it } from "vitest";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";
import {
	buildManualEntryValidationItems,
	buildRequiredManualNutrientValidationItems,
} from "$lib/components/ingredients/manual-entry/utils/validationItems";

const buildItems = ({
	loadingCategoryOptions = false,
	categoryOptionsAvailable = true,
	categoryOptionsError = "",
}: {
	loadingCategoryOptions?: boolean;
	categoryOptionsAvailable?: boolean;
	categoryOptionsError?: string;
} = {}) =>
	buildManualEntryValidationItems({
		normalizedName: "QA Missing Reference Data",
		requiresServingMeasurement: true,
		hasExactServingWeight: true,
		hasExactServingMeasure: false,
		requiresAlcoholByVolume: false,
		alcoholByVolumePercent: null,
		useServingMeasure: false,
		servingMeasureQuantity: null,
		servingMeasureAmountRequiredMessage: "Serving amount is required",
		activeCategory: "Jams and Preserves",
		activeCategoryOptionId: "category-jams",
		loadingCategoryOptions,
		categoryOptionsError,
		categoryOptionsAvailable,
		loadingNutrientRelationshipRules: false,
		nutrientRelationshipRuleError: "",
		manualEntryNutrientAvailabilityItems: [],
		requiredManualNutrientValidationItems: [],
		nutrientRelationshipValidationItems: [],
	});

describe("manual-entry category availability validation", () => {
	it("blocks a previously selected category while the catalog is unavailable", () => {
		expect(buildItems({ categoryOptionsAvailable: false })).toContainEqual({
			message:
				"Food categories are unavailable. Try again after categories finish syncing.",
			tone: "error",
			step: "identity",
		});
	});

	it("preserves a selected category while the catalog is still loading", () => {
		expect(buildItems({ loadingCategoryOptions: true })).not.toContainEqual(
			expect.objectContaining({ step: "identity" }),
		);
	});

	it("accepts the selected category after the catalog is available", () => {
		expect(buildItems()).not.toContainEqual(
			expect.objectContaining({ step: "identity" }),
		);
	});
});

describe("manual-entry private nutrition boundary", () => {
	const requiredField = {
		nutrientId: 1008,
		label: "Calories (kcal)",
		step: "macros",
	} as ManualEntryNutrientDefinition;

	it("treats missing catalog nutrients as nonblocking for a private save", () => {
		expect(
			buildRequiredManualNutrientValidationItems({
				requiredFields: [requiredField],
				getValue: () => null,
				tone: "warning",
			}),
		).toEqual([
			{ message: "Calories is required", tone: "warning", step: "macros" },
		]);
	});

	it("blocks sharing when a required catalog nutrient is missing", () => {
		expect(
			buildRequiredManualNutrientValidationItems({
				requiredFields: [requiredField],
				getValue: () => null,
				tone: "error",
			}),
		).toEqual([
			{ message: "Calories is required", tone: "error", step: "macros" },
		]);
	});
});
