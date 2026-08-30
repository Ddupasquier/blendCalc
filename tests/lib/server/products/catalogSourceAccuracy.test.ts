import { describe, expect, it } from "vitest";
import {
	assessCatalogSourceAccuracy,
	findSubmittedLabelDisagreementMetrics,
} from "$lib/server/products/catalogSourceAccuracy.server";
import { createCatalogFoodFromDraft } from "$lib/server/products/catalogFood.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { NutrientRelationshipRule } from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { PRODUCT_RESOLUTION_POLICY_FIXTURE } from "../../../fixtures/productResolutionPolicy";

const TOTAL_SUGARS_ID = 2000;
const ADDED_SUGARS_ID = 1235;

const createDraft = (
	source: "usda" | "open-food-facts",
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
	barcode: "08801005523455",
	name: "Sempio Gochujang Hot & Sweet Chili Sauce",
	nameProvenance: "source",
	brandOwner: "Sempio Foods Company",
	servingLabel: "1 tbsp (18 g)",
	servingWeightGrams: 18,
	hasSourceServing: true,
	nutrients: [
		{
			nutrientId: TOTAL_SUGARS_ID,
			nutrientName: "Total Sugars",
			nutrientNumber: "269",
			unitName: "G",
			value: 5,
			source,
		},
		{
			nutrientId: ADDED_SUGARS_ID,
			nutrientName: "Added Sugars",
			nutrientNumber: "539",
			unitName: "G",
			value: 5,
			source,
		},
	],
	reportedNutrientIds: [TOTAL_SUGARS_ID, ADDED_SUGARS_ID],
	fieldProvenance: {
		productName: { source, confidence: "unknown" },
		brandOwner: { source, confidence: "unknown" },
		serving: { source, confidence: "unknown" },
		nutrition: { source, confidence: "unknown" },
	},
	source,
	sourceLabel: source === "usda" ? "USDA FoodData Central" : "Open Food Facts",
	sourceReference: source === "usda" ? "123456" : "08801005523455",
	...overrides,
});

const sugarRelationshipRule: NutrientRelationshipRule = {
	id: "added-sugars-lte-total-sugars",
	parentNutrientId: TOTAL_SUGARS_ID,
	childNutrientId: ADDED_SUGARS_ID,
	parentLabel: "Total Sugars",
	childLabel: "Added Sugars",
	relationship: "child_must_not_exceed_parent",
	severity: "error",
	issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT",
	requiresParent: true,
	tolerance: 0,
};

describe("catalog source accuracy", () => {
	it("excludes an internally impossible provider nutrient without discarding the provider", () => {
		const assessment = assessCatalogSourceAccuracy({
			usdaDraft: createDraft("usda", {
				nutrients: [
					{
						nutrientId: TOTAL_SUGARS_ID,
						nutrientName: "Total Sugars",
						nutrientNumber: "269",
						unitName: "G",
						value: 2,
						source: "usda",
					},
					{
						nutrientId: ADDED_SUGARS_ID,
						nutrientName: "Added Sugars",
						nutrientNumber: "539",
						unitName: "G",
						value: 8.33,
						source: "usda",
					},
				],
			}),
			openFoodFactsDraft: null,
			nutrientRelationshipRules: [sugarRelationshipRule],
			policy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
		});

		expect(assessment.usdaDraft).toMatchObject({
			name: "Sempio Gochujang Hot & Sweet Chili Sauce",
			reportedNutrientIds: [TOTAL_SUGARS_ID],
		});
		expect(assessment.usdaDraft?.nutrients).toHaveLength(1);
		expect(assessment.metricIncrements).toContainEqual(
			expect.objectContaining({
				sourceKey: "usda",
				fieldPath: `nutrient:${ADDED_SUGARS_ID}`,
				internallyInvalidCount: 1,
			}),
		);
	});

	it("requires label review for a material cross-provider nutrient disagreement", () => {
		const assessment = assessCatalogSourceAccuracy({
			usdaDraft: createDraft("usda", {
				sourceModifiedDate: "2024-01-01T00:00:00.000Z",
			}),
			openFoodFactsDraft: createDraft("open-food-facts", {
				nutrients: [
					{
						nutrientId: TOTAL_SUGARS_ID,
						nutrientName: "Total Sugars",
						nutrientNumber: "269",
						unitName: "G",
						value: 2,
						source: "open-food-facts",
					},
				],
				reportedNutrientIds: [TOTAL_SUGARS_ID],
				sourceModifiedDate: "2026-08-29T00:00:00.000Z",
			}),
			nutrientRelationshipRules: [sugarRelationshipRule],
			policy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
		});

		expect(assessment.conflicts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fieldPath: `nutrient:${TOTAL_SUGARS_ID}`,
					severity: "high",
				}),
			]),
		);
		expect(assessment.conflicts[0]?.observedValues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					source: "open-food-facts",
					sourceModifiedDate: "2026-08-29T00:00:00.000Z",
				}),
			]),
		);
		expect(assessment.reviewFlags[0]).toContain("current package label");
	});

	it("does not invent a serving disagreement when either source lacks an explicit serving", () => {
		const assessment = assessCatalogSourceAccuracy({
			usdaDraft: createDraft("usda", {
				hasSourceServing: false,
				servingLabel: "100 g",
				servingWeightGrams: 100,
			}),
			openFoodFactsDraft: createDraft("open-food-facts"),
			nutrientRelationshipRules: [sugarRelationshipRule],
			policy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
		});

		expect(
			assessment.conflicts.some(
				(conflict) => conflict.fieldPath === "servingWeightGrams",
			),
		).toBe(false);
	});

	it("records reviewed-label disagreements by provider and field", () => {
		const currentLabelFood = createCatalogFoodFromDraft(createDraft("usda"));
		const staleSource = createDraft("open-food-facts", {
			nutrients: [
				{
					nutrientId: TOTAL_SUGARS_ID,
					nutrientName: "Total Sugars",
					nutrientNumber: "269",
					unitName: "G",
					value: 2,
					source: "open-food-facts",
				},
			],
			reportedNutrientIds: [TOTAL_SUGARS_ID],
		});

		expect(
			findSubmittedLabelDisagreementMetrics(
				currentLabelFood,
				staleSource,
				PRODUCT_RESOLUTION_POLICY_FIXTURE,
			),
		).toContainEqual({
			sourceKey: "open-food-facts",
			fieldPath: `nutrient:${TOTAL_SUGARS_ID}`,
			evaluatedCount: 1,
			submittedLabelDisagreementCount: 1,
		});
	});
});
