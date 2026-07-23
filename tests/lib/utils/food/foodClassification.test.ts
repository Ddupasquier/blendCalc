import { describe, expect, it } from "vitest";
import {
	isPrivateCustomFood,
	isSourceBackedFood,
	normalizePrivateCustomFoodFlag,
} from "$lib/utils/food/records/foodClassification";
import type { FdcFood } from "$lib/utils/food/types";

const food = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: -1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

describe("food classification", () => {
	it("keeps unmatched account-only foods custom", () => {
		const privateFood = food({
			customFood: true,
			sourceKey: "custom",
			barcodeSource: "manual",
		});

		expect(isPrivateCustomFood(privateFood)).toBe(true);
		expect(isSourceBackedFood(privateFood)).toBe(false);
	});

	it("does not classify source-backed or catalog-linked records as custom", () => {
		expect(isPrivateCustomFood(food({
			customFood: true,
			sourceKey: "usda",
			barcodeSource: "usda",
		}))).toBe(false);
		expect(isPrivateCustomFood(food({
			customFood: true,
			sharedProductId: "shared-product-id",
		}))).toBe(false);
		expect(isPrivateCustomFood(food({
			customFood: true,
			sharedProductSubmissionId: "pending-submission-id",
		}))).toBe(false);
	});

	it("clears stale custom flags while preserving private custom records", () => {
		expect(normalizePrivateCustomFoodFlag(food({
			customFood: true,
			sourceKey: "open-food-facts",
		})).customFood).toBe(false);
		expect(normalizePrivateCustomFoodFlag(food({
			customFood: true,
			sourceKey: "custom",
		})).customFood).toBe(true);
	});
});
