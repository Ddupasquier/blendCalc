import { describe, expect, it } from "vitest";
import {
	buildModeratorReviewedCatalogBundle,
	buildUsdaVerifiedCatalogBundle,
	mergeMissingNutrients,
} from "$lib/server/products/catalogVerification.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const nutrient = (nutrientId: number, value: number, unitName = "G") => ({
	nutrientId,
	nutrientName: `Nutrient ${nutrientId}`,
	nutrientNumber: String(nutrientId),
	unitName,
	value,
});

const createUserFood = (): FdcFood => ({
	fdcId: -1,
	description: "Submitted cereal",
	brandOwner: "Submitted Brand",
	barcode: "00012345678905",
	customServingWeightGrams: 30,
	foodNutrients: [
		nutrient(NUTRIENT_IDS.CARBS, 60),
		nutrient(NUTRIENT_IDS.SUGAR, 30),
	],
	reportedNutrientIds: [NUTRIENT_IDS.CARBS, NUTRIENT_IDS.SUGAR],
});

const createUsdaDraft = (): BarcodeProductDraft => ({
	barcode: "00012345678905",
	name: "USDA cereal",
	nameProvenance: "source",
	brandOwner: "USDA Brand",
	servingLabel: "30 g",
	servingWeightGrams: 30,
	nutrients: [
		nutrient(NUTRIENT_IDS.CALORIES, 120, "KCAL"),
		nutrient(NUTRIENT_IDS.FAT, 2),
		nutrient(NUTRIENT_IDS.CARBS, 15),
		nutrient(NUTRIENT_IDS.FIBER, 2),
		nutrient(NUTRIENT_IDS.SUGAR, 3),
		nutrient(NUTRIENT_IDS.PROTEIN, 4),
		nutrient(NUTRIENT_IDS.SODIUM, 100, "MG"),
	],
	reportedNutrientIds: [
		NUTRIENT_IDS.CALORIES,
		NUTRIENT_IDS.FAT,
		NUTRIENT_IDS.CARBS,
		NUTRIENT_IDS.FIBER,
		NUTRIENT_IDS.SUGAR,
		NUTRIENT_IDS.PROTEIN,
		NUTRIENT_IDS.SODIUM,
	],
	source: "usda",
	sourceLabel: "USDA FoodData Central",
	sourceReference: "12345",
});

const cerealCategory = {
	categoryOptionId: "breakfast-cereals",
	label: "Breakfast Cereals",
	sourceValue: "breakfast cereals",
	confidence: "exact",
};

describe("catalog verification", () => {
	it("uses exact-barcode USDA data as canonical and records disagreements", () => {
		const bundle = buildUsdaVerifiedCatalogBundle(
			createUserFood(),
			createUsdaDraft(),
			cerealCategory,
		);

		expect(bundle.canonicalFood.description).toBe("USDA Cereal");
		expect(bundle.canonicalFood.foodCategory).toBe("Breakfast Cereals");
		expect(bundle.canonicalFood.categories).toContain("Breakfast Cereals");
		expect(bundle.observations.map((item) => item.source)).toEqual([
			"user-label",
			"usda",
		]);
		expect(bundle.provenance).toContainEqual(
			expect.objectContaining({
				fieldPath: `nutrient:${NUTRIENT_IDS.SUGAR}`,
				observationKey: "usda",
				verificationMethod: "exact-barcode",
			}),
		);
		expect(bundle.conflicts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fieldPath: "brandOwner" }),
				expect.objectContaining({ fieldPath: `nutrient:${NUTRIENT_IDS.SUGAR}` }),
			]),
		);
	});

	it("marks moderator-reviewed label data without inventing another source", () => {
		const bundle = buildModeratorReviewedCatalogBundle(createUserFood());

		expect(bundle.observations).toHaveLength(1);
		expect(bundle.provenance.every((item) => item.confidence === "moderator-reviewed"))
			.toBe(true);
		expect(bundle.conflicts).toEqual([]);
	});

	it("fills only nutrients that the primary source did not report", () => {
		const primary = createUserFood();
		const supplement: FdcFood = {
			...primary,
			foodNutrients: [
				nutrient(NUTRIENT_IDS.SUGAR, 99),
				nutrient(NUTRIENT_IDS.SODIUM, 50, "MG"),
			],
			reportedNutrientIds: [NUTRIENT_IDS.SUGAR, NUTRIENT_IDS.SODIUM],
		};

		const merged = mergeMissingNutrients(primary, supplement);
		expect(
			merged.foodNutrients.find((item) => item.nutrientId === NUTRIENT_IDS.SUGAR)?.value,
		).toBe(30);
		expect(
			merged.foodNutrients.find((item) => item.nutrientId === NUTRIENT_IDS.SODIUM)?.value,
		).toBe(50);
	});
});
