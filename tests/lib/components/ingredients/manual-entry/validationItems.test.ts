import { describe, expect, it } from "vitest";
import { buildManualEntryValidationItems } from "$lib/components/ingredients/manual-entry/utils/validationItems";

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
		servingWeightGrams: 100,
		useVolumeEquivalent: false,
		volumeQuantity: null,
		volumeAmountRequiredMessage: "Volume is required",
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
			message: "Food categories are unavailable. Try again after categories finish syncing.",
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
