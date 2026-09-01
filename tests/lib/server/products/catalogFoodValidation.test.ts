import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import { NUTRIENT_IDS } from "$lib/utils/food/types";

const mocks = vi.hoisted(() => ({
	getNutrientDefinitionCatalog: vi.fn(),
	readNutrientRelationshipRules: vi.fn(),
}));

vi.mock("$lib/server/nutrition/nutrientDefinitionCatalog.server", () => ({
	getNutrientDefinitionCatalog: mocks.getNutrientDefinitionCatalog,
}));

vi.mock(
	"$lib/utils/food/nutrients/nutrientRelationshipRules",
	async (importOriginal) => ({
		...(await importOriginal()),
		readNutrientRelationshipRules: mocks.readNutrientRelationshipRules,
	}),
);

import { assertSharedProductFoodCanBePublished } from "$lib/server/products/catalogFoodValidation.server";

const createFood = (nutrientIds: number[]): FoodItem => ({
	fdcId: -1,
	description: "Private boundary test product",
	barcode: "00012345678905",
	customServingWeightGrams: 30,
	foodNutrients: nutrientIds.map((nutrientId) => ({
		nutrientId,
		nutrientName: nutrientId === NUTRIENT_IDS.CALORIES ? "Energy" : "Total Fat",
		nutrientNumber: nutrientId === NUTRIENT_IDS.CALORIES ? "208" : "204",
		unitName: nutrientId === NUTRIENT_IDS.CALORIES ? "KCAL" : "G",
		value: 0,
	})),
});

const createSupabase = (requiredNutrientIds: number[]) => ({
	from: vi.fn(() => ({
		select: vi.fn(() => ({
			eq: vi.fn().mockResolvedValue({
				data: requiredNutrientIds.map((nutrient_id) => ({ nutrient_id })),
				error: null,
			}),
		})),
	})),
});

describe("shared-product required nutrient boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readNutrientRelationshipRules.mockResolvedValue([
			{
				id: "configured-rule",
				parentNutrientId: NUTRIENT_IDS.FAT,
				childNutrientId: NUTRIENT_IDS.SUGAR,
				parentLabel: "Total Fat",
				childLabel: "Saturated Fat",
				relationship: "child_must_not_exceed_parent",
				severity: "error",
				issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT",
				requiresParent: false,
				tolerance: 0,
			},
		]);
		mocks.getNutrientDefinitionCatalog.mockResolvedValue([
			{
				nutrient_id: NUTRIENT_IDS.CALORIES,
				nutrient_name: "Energy",
				nutrient_number: "208",
				default_unit_name: "KCAL",
			},
			{
				nutrient_id: NUTRIENT_IDS.FAT,
				nutrient_name: "Total Fat",
				nutrient_number: "204",
				default_unit_name: "G",
			},
		]);
	});

	it("rejects sharing when a catalog-required nutrient is absent", async () => {
		await expect(
			assertSharedProductFoodCanBePublished(
				createSupabase([NUTRIENT_IDS.CALORIES, NUTRIENT_IDS.FAT]) as never,
				createFood([NUTRIENT_IDS.CALORIES]),
			),
		).rejects.toThrow("Shared products require values for: Total Fat.");
	});

	it("accepts explicitly reported zeroes for every required nutrient", async () => {
		await expect(
			assertSharedProductFoodCanBePublished(
				createSupabase([NUTRIENT_IDS.CALORIES, NUTRIENT_IDS.FAT]) as never,
				createFood([NUTRIENT_IDS.CALORIES, NUTRIENT_IDS.FAT]),
			),
		).resolves.toMatchObject({ valid: true });
	});
});
