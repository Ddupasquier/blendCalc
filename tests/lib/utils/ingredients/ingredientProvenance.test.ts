import { describe, expect, it } from "vitest";
import {
	getFoodSourceKey,
	getFoodTrustStatus,
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
	{
		dimension: "trust",
		value: "pending-review",
		filter_label: "Pending review",
		badge_label: "Pending",
		badge_tone: "info",
		display_order: 45,
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

	it("keeps provider identity neutral until evidence is recorded", () => {
		expect(getFoodSourceKey(food({ sourceKey: "open-food-facts" }))).toBe(
			"open-food-facts",
		);
		expect(getFoodTrustStatus(food({ sourceKey: "open-food-facts" })))
			.toBe("unverified");
		expect(getFoodTrustStatus(food({ sourceKey: "usda" })))
			.toBe("unverified");
		expect(
			getFoodTrustStatus(food({
				sourceKey: "shared-catalog",
				sharedProductConfidence: "moderator-reviewed",
			})),
		).toBe("moderator-reviewed");
	});

	it("prefers normalized catalog links over private JSON snapshots", () => {
		const reviewedFood = food({
			customFood: true,
			sourceKey: "custom",
			sharedProductId: "shared-product-id",
		});
		const pendingFood = food({
			customFood: true,
			sourceKey: "usda",
			trustStatus: "pending-review",
		});

		expect(getFoodSourceKey(reviewedFood)).toBe("shared-catalog");
		expect(getFoodTrustStatus(reviewedFood)).toBe("unverified");
		expect(getFoodTrustStatus(pendingFood)).toBe("pending-review");
	});

	it("filters source and trust independently", () => {
		const usdaFood = food({
			sourceKey: "usda",
			trustStatus: "source-verified",
		});
		expect(matchesIngredientProvenance(usdaFood, "usda", "source-verified"))
			.toBe(true);
		expect(matchesIngredientProvenance(usdaFood, "open-food-facts", "any"))
			.toBe(false);
		expect(matchesIngredientProvenance(usdaFood, "all", "user-private"))
			.toBe(false);
	});

	it("builds the database-configured actionable verification badge", () => {
		const usdaFood = food({
			sourceKey: "usda",
			trustStatus: "source-verified",
		});
		expect(getIngredientTrustBadge(usdaFood, options)).toMatchObject({
			value: "verified",
			label: "Verified",
		});
	});

	it("does not assign an unknown origin to USDA", () => {
		expect(getFoodSourceKey(food({}))).toBe("unknown");
	});

	it("maps imported acceptance metadata to neutral unverified state", () => {
		expect(getFoodTrustStatus(food({
			sourceKey: "open-food-facts",
			trustStatus: "imported",
		}))).toBe("unverified");
		expect(getIngredientTrustBadge(food({
			sourceKey: "open-food-facts",
			trustStatus: "imported",
		}), options)).toBeNull();
	});
});
