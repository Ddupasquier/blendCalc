import { describe, expect, it } from "vitest";
import { mapApprovedCatalogRecordToApiV1Product } from "$lib/server/api/v1/catalogApi.server";
import { annotateFoodWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { createCatalogFoodFromDraft } from "$lib/server/products/catalogFood.server";
import type { ApprovedCatalogRecord } from "$lib/server/products/catalogRead.server";
import { mapOpenFoodFactsProduct } from "$lib/utils/barcode/barcodeProductMappers";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";
import { getFoodCompatibilityEvaluationMessage } from "$lib/utils/food/quality/foodCompatibilityEvaluationMessages";
import type { FoodItem } from "$lib/utils/food/types";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import {
	FOOD_SAFETY_END_TO_END_CORPUS,
	FOOD_SAFETY_END_TO_END_POLICY,
	FOOD_SAFETY_END_TO_END_REQUIRED_FEATURES,
} from "../../../fixtures/foodSafetyEndToEndCorpus";
import { productReferenceCatalogFixture } from "../../../fixtures/referenceCatalogs";

const normalizePreference = (value: string) =>
	value.toLocaleLowerCase().trim().replace(/\s+/g, "-");

const createProfile = (
	allergens: string[] = [],
	dietaryRestrictions: string[] = [],
): FoodPreferenceProfile => ({
	unitSystem: "metric",
	allergens,
	dietaryRestrictions,
	prioritizedNutrientIds: [],
	defaultMixServingGrams: null,
	sensitiveAcknowledgedAt: "2026-07-31T17:00:00.000Z",
	regulatoryRegionCode: null,
	regulatoryRegionSource: null,
	preferenceResolutions: [
		...allergens.map((value, index) => ({
			rawValue: value,
			normalizedValue: normalizePreference(value),
			ruleType: "allergen" as const,
			status: "resolved" as const,
			method: "direct_tag" as const,
			policyVersionId: "00000000-0000-4000-8000-000000000002",
			languageCode: "und",
			ingredientTermId: null,
			ingredientAliasId: null,
			preferenceTermMappingId: null,
			tag: {
				id: `00000000-0000-4000-8100-${String(index + 1).padStart(12, "0")}`,
				slug: normalizePreference(value),
				label: value,
				category: "allergen" as const,
			},
		})),
		...dietaryRestrictions.map((value, index) => ({
			rawValue: value,
			normalizedValue: normalizePreference(value),
			ruleType: "dietary_restriction" as const,
			status: "resolved" as const,
			method: "direct_tag" as const,
			policyVersionId: "00000000-0000-4000-8000-000000000002",
			languageCode: "und",
			ingredientTermId: null,
			ingredientAliasId: null,
			preferenceTermMappingId: null,
			tag: {
				id: `00000000-0000-4000-8200-${String(index + 1).padStart(12, "0")}`,
				slug: normalizePreference(value),
				label: value,
				category: "dietary" as const,
			},
		})),
	],
});

const createApprovedRecord = (
	id: string,
	barcode: string,
	food: FoodItem,
): ApprovedCatalogRecord => ({
	id: `synthetic-${id}`,
	barcode,
	productName: food.description,
	brandOwner: food.brandOwner ?? null,
	category: null,
	canonicalProvenance: {},
	fieldProvenance: {},
	source: "open-food-facts",
	sourceReference: barcode,
	confidence: "imported",
	createdAt: "2026-07-31T17:00:00.000Z",
	updatedAt: "2026-07-31T17:00:00.000Z",
	lastVerifiedAt: null,
	revision: {
		id: `synthetic-revision-${id}`,
		number: food.sourceMetadata?.revision ?? 1,
		createdAt: "2026-07-31T17:00:00.000Z",
		labelObservedAt: "2026-07-31T17:00:00.000Z",
	},
	food,
	images: [],
});

const buildCorpusFood = (
	corpusCase: (typeof FOOD_SAFETY_END_TO_END_CORPUS)[number],
): FoodItem => {
	if (corpusCase.kind === "private-custom") {
		return createCustomFood(corpusCase.food);
	}
	if (corpusCase.kind === "generic") return corpusCase.food;

	const draft = mapOpenFoodFactsProduct(
		corpusCase.product,
		corpusCase.barcode,
		productReferenceCatalogFixture,
	);
	if (!draft) throw new Error(`Unable to normalize corpus case ${corpusCase.id}.`);
	return createCatalogFoodFromDraft(draft);
};

describe("synthetic end-to-end food-safety corpus", () => {
	it.each(FOOD_SAFETY_END_TO_END_CORPUS)(
		"$id: $name",
		(corpusCase) => {
			const normalizedFood = buildCorpusFood(corpusCase);
			const evaluatedFood = annotateFoodWithFoodSafety(normalizedFood, {
				profile: createProfile(
					corpusCase.preferences.allergens,
					corpusCase.preferences.dietaryRestrictions,
				),
				policy: FOOD_SAFETY_END_TO_END_POLICY,
			});
			const warningLabels = (evaluatedFood.preferenceWarnings ?? [])
				.map((warning) => warning.label)
				.sort();

			expect(warningLabels).toEqual(
				[...corpusCase.expected.warningLabels].sort(),
			);
			expect(evaluatedFood.compatibilityEvaluation?.status)
				.toBe(corpusCase.expected.status);
			expect(evaluatedFood.allergenDisclosure?.contains ?? [])
				.toEqual(expect.arrayContaining(corpusCase.expected.contains ?? []));
			expect(evaluatedFood.allergenDisclosure?.mayContain ?? [])
				.toEqual(expect.arrayContaining(corpusCase.expected.mayContain ?? []));
			expect((normalizedFood.precautionaryStatements ?? []).map(
				(statement) => statement.type,
			)).toEqual(expect.arrayContaining(
				corpusCase.expected.precautionaryTypes ?? [],
			));

			const userMessage = getFoodCompatibilityEvaluationMessage(
				evaluatedFood.compatibilityEvaluation!,
			);
			expect(userMessage.title).not.toMatch(/failed|error|exception/i);
			expect(userMessage.message).toContain("package label");

			if (corpusCase.kind === "open-food-facts") {
				const apiProduct = mapApprovedCatalogRecordToApiV1Product(
					createApprovedRecord(
						corpusCase.id,
						corpusCase.barcode,
						evaluatedFood,
					),
				);
				expect(apiProduct.ingredients.text)
					.toBe(normalizedFood.ingredients ?? null);
				expect(apiProduct.warnings.map((warning) => warning.code))
					.toEqual(expect.arrayContaining(
						(evaluatedFood.compatibilitySummary?.allFacts ?? [])
							.map((fact) => fact.slug),
					));
				expect(apiProduct.ingredients.precautionaryStatements.map(
					(statement) => statement.type,
				)).toEqual(expect.arrayContaining(
					corpusCase.expected.precautionaryTypes ?? [],
				));
			}
		},
	);

	it("reports separate extraction, evaluation, serialization, and message coverage", () => {
		const coveredStages = new Set(
			FOOD_SAFETY_END_TO_END_CORPUS.flatMap((corpusCase) => corpusCase.stages),
		);
		const coveredFeatures = new Set(
			FOOD_SAFETY_END_TO_END_CORPUS.flatMap((corpusCase) => corpusCase.features),
		);

		expect(FOOD_SAFETY_END_TO_END_CORPUS.length).toBeGreaterThanOrEqual(17);
		expect([...coveredStages].sort()).toEqual([
			"api-serialization",
			"ingredient-extraction",
			"multilingual-matching",
			"policy-evaluation",
			"precautionary-preservation",
			"provider-normalization",
			"user-message",
		]);
		expect(
			FOOD_SAFETY_END_TO_END_REQUIRED_FEATURES.filter(
				(feature) => !coveredFeatures.has(feature),
			),
		).toEqual([]);
		expect(
			FOOD_SAFETY_END_TO_END_CORPUS.filter(
				(corpusCase) => corpusCase.features.includes("negative-control"),
			).length,
		).toBeGreaterThanOrEqual(3);
	});
});
