import { describe, expect, it } from "vitest";
import { assessNutritionCompleteness } from "$lib/utils/food/quality/nutritionCompletenessAssessment";
import type { NutritionCompletenessCatalog } from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";

const completeFood = {
	fdcId: 1,
	description: "Complete food",
	foodIdentityType: "generic",
	foodNutrients: [
		[NUTRIENT_IDS.CALORIES, "Energy", "208", "KCAL", 100],
		[NUTRIENT_IDS.FAT, "Total lipid (fat)", "204", "G", 1],
		[NUTRIENT_IDS.CARBS, "Carbohydrate", "205", "G", 10],
		[NUTRIENT_IDS.FIBER, "Fiber", "291", "G", 2],
		[NUTRIENT_IDS.SUGAR, "Sugars", "269", "G", 5],
		[NUTRIENT_IDS.PROTEIN, "Protein", "203", "G", 3],
		[NUTRIENT_IDS.SODIUM, "Sodium, Na", "307", "MG", 5],
	].map(([nutrientId, nutrientName, nutrientNumber, unitName, value]) => ({
		nutrientId: Number(nutrientId),
		nutrientName: String(nutrientName),
		nutrientNumber: String(nutrientNumber),
		unitName: String(unitName),
		value: Number(value),
	})),
} satisfies FoodItem;

const resolvedFood = {
	fdcId: 2,
	description: "Oil",
	sourceKey: "usda",
	foodIdentityType: "generic",
	foodNutrients: [
		{
			nutrientId: 1085,
			nutrientName: "Total fat (NLEA)",
			nutrientNumber: "298",
			unitName: "G",
			value: 93.2,
		},
		{
			nutrientId: NUTRIENT_IDS.CARBS,
			nutrientName: "Carbohydrate",
			nutrientNumber: "205",
			unitName: "G",
			value: 0,
		},
		{
			nutrientId: NUTRIENT_IDS.PROTEIN,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "G",
			value: 0,
		},
	],
} satisfies FoodItem;

const boundaryCatalog: NutritionCompletenessCatalog = {
	profiles: [
		{
			key: "boundary-profile",
			assessmentPolicyKey: "boundary-policy",
			displayName: "Boundary profile",
			foodScope: "generic",
			regionCode: "",
			completeLabel: "Complete",
			resolvedLabel: "Resolved",
			partialLabel: "Partial",
			limitedLabel: "Limited",
			description: "Boundary test profile",
			sourceKey: "test",
			sourceReference: "test",
			isDefault: true,
			exactSourceScore: 3,
			mappedSourceScore: 2,
			derivedSourceScore: 1,
			missingSourceScore: 0,
			requiredNutrientWeight: 4,
			recommendedNutrientWeight: 1,
			partialMinimumRatio: 0.75,
			nutrients: [
				[NUTRIENT_IDS.CALORIES, "Energy", "KCAL"],
				[NUTRIENT_IDS.FAT, "Fat", "G"],
				[NUTRIENT_IDS.CARBS, "Carbohydrate", "G"],
				[NUTRIENT_IDS.PROTEIN, "Protein", "G"],
			].map(([nutrientId, label, unitName], displayOrder) => ({
				nutrientId: Number(nutrientId),
				label: String(label),
				unitName: String(unitName),
				requirementLevel: "required" as const,
				displayOrder,
				reason: "Boundary coverage",
			})),
		},
	],
};

describe("nutrition completeness assessment", () => {
	it("marks complete exact required data", () => {
		expect(assessNutritionCompleteness(completeFood)).toMatchObject({
			label: "Complete",
			missingCount: 0,
		});
	});

	it("counts mapped and derived values separately", () => {
		const assessment = assessNutritionCompleteness(resolvedFood);

		expect(assessment.sourceCounts.mapped).toBe(1);
		expect(assessment.sourceCounts.derived).toBe(0);
		expect(assessment.sourceCounts.missing).toBe(4);
		expect(assessment.missingCount).toBe(2);
		expect(assessment.recommendedMissingCount).toBe(2);
		expect(assessment.needsDetails).toBe(true);
		expect(
			assessment.details.filter((detail) => detail.source === "missing"),
		).toEqual([
			expect.objectContaining({ label: "Energy" }),
			expect.objectContaining({ label: "Sodium, Na" }),
			expect.objectContaining({ label: "Dietary Fiber" }),
			expect.objectContaining({ label: "Total Sugars" }),
		]);
		expect(assessment.details).not.toContainEqual(
			expect.objectContaining({ source: "derived" }),
		);
	});

	it("does not call generic food partial when only recommended nutrients are missing", () => {
		const food = {
			...completeFood,
			foodNutrients: completeFood.foodNutrients.filter(
				(nutrient) =>
					nutrient.nutrientId !== NUTRIENT_IDS.FIBER &&
					nutrient.nutrientId !== NUTRIENT_IDS.SUGAR,
			),
		};

		expect(assessNutritionCompleteness(food)).toMatchObject({
			label: "Complete",
			missingCount: 0,
			recommendedMissingCount: 2,
			needsDetails: false,
		});
	});

	it("uses the packaged profile when a barcode is present", () => {
		const packagedFood = {
			...completeFood,
			foodIdentityType: "packaged" as const,
			barcode: "00021130462506",
		};

		expect(assessNutritionCompleteness(packagedFood)).toMatchObject({
			label: "Partial label",
			profileKey: "us-packaged-label-v1",
			missingCount: 1,
		});
	});

	it("does not judge a regulated alcohol label against ordinary packaged nutrients", () => {
		const regulatedAlcohol = {
			fdcId: 7,
			description: "Hard lemonade",
			foodIdentityType: "packaged" as const,
			barcode: "00649754706570",
			foodNutrients: [],
			regulatoryDisclosure: {
				profileKey: "us-ttb-alcohol-beverage-v1",
				evidenceStatus: "source-reported" as const,
			},
			alcoholByVolume: {
				percent: 6.5,
				valueStatus: "reported" as const,
				basis: "volume-percent" as const,
				sourceUnit: "% ABV",
			},
		} satisfies FoodItem;

		expect(assessNutritionCompleteness(regulatedAlcohol)).toMatchObject({
			status: "limited",
			label: "Alcohol beverage label",
			profileKey: "us-ttb-alcohol-beverage-v1",
			missingCount: 0,
			needsDetails: false,
		});

		const missingAlcoholByVolume = {
			...regulatedAlcohol,
			alcoholByVolume: undefined,
		};
		expect(assessNutritionCompleteness(missingAlcoholByVolume)).toMatchObject({
			status: "limited",
			needsDetails: true,
			title: "The package's alcohol percentage has not been reported yet.",
		});
	});

	it("uses the private manual profile for a private custom food with a barcode", () => {
		const privateManualFood = {
			...completeFood,
			barcode: "00021130462506",
			customFood: true,
			trustStatus: "user-private" as const,
		};

		expect(assessNutritionCompleteness(privateManualFood)).toMatchObject({
			label: "Complete",
			profileKey: "private-manual-core-v1",
			completeCount: 5,
			missingCount: 0,
			needsDetails: false,
		});
	});

	it("keeps the packaged profile for a custom food submitted for review", () => {
		const pendingFood = {
			...completeFood,
			foodIdentityType: "packaged" as const,
			barcode: "00021130462506",
			customFood: true,
			trustStatus: "pending-review" as const,
		};

		expect(assessNutritionCompleteness(pendingFood)).toMatchObject({
			label: "Partial label",
			profileKey: "us-packaged-label-v1",
			missingCount: 1,
		});
	});

	it("does not invent a completeness profile for unknown food identity", () => {
		const assessment = assessNutritionCompleteness({
			...completeFood,
			foodIdentityType: "unknown",
			dataType: "Future source type",
		});

		expect(assessment).toMatchObject({
			status: "unavailable",
			profileKey: null,
		});
	});

	it("uses the reviewed partial threshold at its exact boundary", () => {
		const threeOfFour = {
			...completeFood,
			foodNutrients: completeFood.foodNutrients.filter(
				(nutrient) => nutrient.nutrientId !== NUTRIENT_IDS.PROTEIN,
			),
		};
		const twoOfFour = {
			...threeOfFour,
			foodNutrients: threeOfFour.foodNutrients.filter(
				(nutrient) => nutrient.nutrientId !== NUTRIENT_IDS.CARBS,
			),
		};

		expect(
			assessNutritionCompleteness(threeOfFour, boundaryCatalog).status,
		).toBe("partial");
		expect(assessNutritionCompleteness(twoOfFour, boundaryCatalog).status).toBe(
			"limited",
		);
	});
});
