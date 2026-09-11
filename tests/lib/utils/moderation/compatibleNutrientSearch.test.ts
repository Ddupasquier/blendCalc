import { describe, expect, it } from "vitest";
import { searchCompatibleNutrients } from "$lib/utils/moderation/compatibleNutrientSearch";
import { nutrientMappingReviewWorkspaceFixture } from "../../../fixtures/nutrientMappingReview";

const nutrients = nutrientMappingReviewWorkspaceFixture.compatibleNutrients;

describe("searchCompatibleNutrients", () => {
	it("matches canonical names, nutrient numbers, and canonical IDs", () => {
		expect(searchCompatibleNutrients(nutrients, "arachidonic")).toMatchObject([
			{ nutrientId: 700855 },
		]);
		expect(searchCompatibleNutrients(nutrients, "855")).toMatchObject([
			{ nutrientId: 700855 },
		]);
		expect(searchCompatibleNutrients(nutrients, "700855")).toMatchObject([
			{ nutrientId: 700855 },
		]);
	});

	it("supports normalized multi-word searches and returns every choice when cleared", () => {
		expect(
			searchCompatibleNutrients(nutrients, "polyunsaturated arachidonic"),
		).toMatchObject([{ nutrientId: 700855 }]);
		expect(searchCompatibleNutrients(nutrients, "")).toEqual(nutrients);
		expect(
			searchCompatibleNutrients(nutrients, "unavailable nutrient"),
		).toEqual([]);
	});
});
