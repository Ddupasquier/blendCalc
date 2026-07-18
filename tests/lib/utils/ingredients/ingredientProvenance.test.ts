import { describe, expect, it } from "vitest";
import {
	getFoodSourceKey,
	getFoodTrustStatus,
	getIngredientFilterOptions,
	getIngredientSourceBadge,
	getIngredientTrustBadge,
	matchesIngredientProvenance,
	type IngredientProvenanceOption,
} from "$lib/utils/ingredients/ingredientProvenance";
import type { FdcFood } from "$lib/utils/food/types";

const food = (values: Partial<FdcFood>): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...values,
});

const options: IngredientProvenanceOption[] = [
	{
		dimension: "source",
		value: "usda",
		filter_label: "USDA",
		badge_label: "USDA",
		badge_tone: "info",
		display_order: 10,
		filter_enabled: true,
		badge_enabled: true,
	},
	{
		dimension: "trust",
		value: "source-verified",
		filter_label: "Source verified",
		badge_label: "Verified",
		badge_tone: "success",
		display_order: 10,
		filter_enabled: true,
		badge_enabled: true,
	},
];

describe("ingredient provenance", () => {
	it("keeps provider origin separate from private review status", () => {
		const privateUsdaFood = food({
			customFood: true,
			sourceKey: "usda",
			barcodeSource: "usda",
		});

		expect(getFoodSourceKey(privateUsdaFood)).toBe("usda");
		expect(getFoodTrustStatus(privateUsdaFood)).toBe("user-private");
	});

	it("recognizes external and reviewed catalog sources", () => {
		expect(getFoodSourceKey(food({ sourceKey: "open-food-facts" }))).toBe(
			"open-food-facts",
		);
		expect(
			getFoodTrustStatus(food({
				sourceKey: "shared-catalog",
				sharedProductConfidence: "moderator-reviewed",
			})),
		).toBe("moderator-reviewed");
	});

	it("filters source and trust independently", () => {
		const usdaFood = food({ sourceKey: "usda" });
		expect(matchesIngredientProvenance(usdaFood, "usda", "source-verified"))
			.toBe(true);
		expect(matchesIngredientProvenance(usdaFood, "open-food-facts", "any"))
			.toBe(false);
		expect(matchesIngredientProvenance(usdaFood, "all", "user-private"))
			.toBe(false);
	});

	it("builds database-configured filters and badges", () => {
		const usdaFood = food({ sourceKey: "usda" });
		expect(getIngredientFilterOptions(options, "source")).toEqual([
			{ value: "usda", label: "USDA" },
		]);
		expect(getIngredientSourceBadge(usdaFood, options)?.label).toBe("USDA");
		expect(getIngredientTrustBadge(usdaFood, options)?.label).toBe("Verified");
	});
});
