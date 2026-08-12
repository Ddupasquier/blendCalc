import { describe, expect, it } from "vitest";
import { enrichListFoodWithExactSourceEvidence } from "$lib/utils/food/records/exactSourceListEnrichment";
import type {
	FoodFieldSource,
	FoodItem,
	FoodNutrient,
} from "$lib/utils/food/types";

const fieldSource = (
	confidence: FoodFieldSource["confidence"],
	overrides: Partial<FoodFieldSource> = {},
): FoodFieldSource => ({
	source: "usda",
	sourceReference: "171032",
	confidence,
	verificationMethod: "exact-source-record",
	reviewState: "accepted",
	observedAt: "2026-01-01T00:00:00.000Z",
	...overrides,
});

const nutrient = (
	nutrientId: number,
	value: number,
	overrides: Partial<FoodNutrient> = {},
): FoodNutrient => ({
	nutrientId,
	nutrientName: nutrientId === 1008 ? "Energy" : "Total lipid (fat)",
	nutrientNumber: nutrientId === 1008 ? "208" : "204",
	unitName: nutrientId === 1008 ? "kcal" : "g",
	value,
	valueOrigin: "reported",
	valueStatus: value === 0 ? "reported-zero" : "reported",
	source: "usda",
	sourceReference: "171032",
	confidence: "imported",
	...overrides,
});

const current: FoodItem = {
	fdcId: 171032,
	description: "Oil, Apricot Kernel",
	nameProvenance: "source",
	foodIdentityType: "generic",
	foodCategory: "Fats and Oils",
	categoryOptionId: "fats-and-oils",
	foodNutrients: [nutrient(1008, 884)],
	reportedNutrientIds: [1008],
	sourceKey: "usda",
	listAddedAt: 123,
	fieldProvenance: {
		productName: fieldSource("imported"),
		nutrition: fieldSource("imported"),
		categories: fieldSource("moderator-reviewed", {
			reviewState: "moderator-reviewed",
		}),
	},
};

describe("exact-source list enrichment", () => {
	it("fills missing fields without replacing equal-evidence values", () => {
		const result = enrichListFoodWithExactSourceEvidence(current, {
			...current,
			description: "Oil, apricot kernel",
			foodCategory: "Oil",
			foodNutrients: [nutrient(1008, 900), nutrient(1004, 100)],
			reportedNutrientIds: [1008, 1004],
			foodServings: [{
				label: "1 tablespoon",
				gramWeight: 13.6,
				isPrimary: true,
				source: "usda",
			}],
			hasSourceServing: true,
			fieldProvenance: {
				productName: fieldSource("imported"),
				nutrition: fieldSource("imported"),
				categories: fieldSource("imported"),
				serving: fieldSource("imported"),
			},
		});

		expect(result.description).toBe("Oil, Apricot Kernel");
		expect(result.foodCategory).toBe("Fats and Oils");
		expect(result.categoryOptionId).toBe("fats-and-oils");
		expect(result.listAddedAt).toBe(123);
		expect(result.foodNutrients).toEqual([
			expect.objectContaining({ nutrientId: 1004, value: 100 }),
			expect.objectContaining({ nutrientId: 1008, value: 884 }),
		]);
		expect(result.foodServings?.[0]).toMatchObject({
			label: "1 tablespoon",
			gramWeight: 13.6,
		});
		expect(result.sourceEnrichmentDecisions).toEqual(expect.arrayContaining([
			expect.objectContaining({
				field: "serving",
				reason: "missing-current-value",
			}),
			expect.objectContaining({
				field: "nutrition",
				nutrientId: 1004,
				reason: "missing-current-value",
			}),
		]));
		expect(result.sourceEnrichmentDecisions).not.toEqual(expect.arrayContaining([
			expect.objectContaining({ field: "nutrition", nutrientId: 1008 }),
		]));
	});

	it("fills a missing field with accepted source evidence", () => {
		const result = enrichListFoodWithExactSourceEvidence(current, {
			...current,
			brandOwner: "Verified Brand",
			fieldProvenance: {
				brandOwner: fieldSource("moderator-reviewed", {
					source: "community-reviewed",
					observationId: "observation-1",
					reviewState: "moderator-reviewed",
					verificationMethod: "moderator-reviewed",
				}),
			},
		});

		expect(result.brandOwner).toBe("Verified Brand");
		expect(result.fieldProvenance?.brandOwner).toMatchObject({
			source: "community-reviewed",
			observationId: "observation-1",
		});
		expect(result.sourceEnrichmentDecisions).toContainEqual(expect.objectContaining({
			field: "brandOwner",
			reason: "missing-current-value",
		}));
	});

	it("replaces a populated source field only when review evidence is stronger", () => {
		const result = enrichListFoodWithExactSourceEvidence(
			{
				...current,
				brandOwner: "Unreviewed Brand",
				fieldProvenance: {
					brandOwner: fieldSource("source-verified", {
						reviewState: "unreviewed",
					}),
				},
			},
			{
				...current,
				brandOwner: "Accepted Brand",
				fieldProvenance: {
					brandOwner: fieldSource("imported", {
						reviewState: "accepted",
						observationId: "accepted-observation",
					}),
				},
			},
		);

		expect(result.brandOwner).toBe("Accepted Brand");
		expect(result.sourceEnrichmentDecisions).toContainEqual(expect.objectContaining({
			field: "brandOwner",
			reason: "stronger-review-state",
		}));
	});

	it("preserves user-entered fields and nutrients regardless of provider confidence", () => {
		const userSource: FoodFieldSource = {
			source: "user-label",
			confidence: "user-reported",
			reviewState: "unreviewed",
		};
		const result = enrichListFoodWithExactSourceEvidence(
			{
				...current,
				description: "My Cooking Oil",
				nameProvenance: "user",
				ingredients: "Apricot kernel oil",
				foodNutrients: [nutrient(1008, 777, {
					source: "user-label",
					confidence: "user-reported",
				})],
				fieldProvenance: {
					productName: userSource,
					ingredients: userSource,
					nutrition: userSource,
				},
			},
			{
				...current,
				description: "Oil, Apricot Kernel",
				ingredients: "Source ingredients",
				foodNutrients: [nutrient(1008, 884, {
					confidence: "moderator-reviewed",
				})],
				fieldProvenance: {
					productName: fieldSource("moderator-reviewed"),
					ingredients: fieldSource("moderator-reviewed"),
					nutrition: fieldSource("moderator-reviewed"),
				},
			},
		);

		expect(result.description).toBe("My Cooking Oil");
		expect(result.canonicalDescription).toBe("Oil, Apricot Kernel");
		expect(result.ingredients).toBe("Apricot kernel oil");
		expect(result.foodNutrients[0]).toMatchObject({ value: 777, source: "user-label" });
	});

	it("does not enrich a private unmatched food", () => {
		const privateFood: FoodItem = {
			...current,
			fdcId: -1,
			description: "My Private Oil",
			foodIdentityType: "private-custom",
			customFood: true,
			sourceKey: undefined,
			barcode: undefined,
			gtinUpc: undefined,
			fieldProvenance: undefined,
		};
		const source = {
			...current,
			brandOwner: "Should Not Appear",
		};

		expect(enrichListFoodWithExactSourceEvidence(privateFood, source))
			.toBe(privateFood);
	});

	it("uses a newer observation only after review and confidence tie", () => {
		const result = enrichListFoodWithExactSourceEvidence(
			{
				...current,
				brandOwner: "Old Brand",
				fieldProvenance: {
					brandOwner: fieldSource("source-verified", {
						observedAt: "2025-01-01T00:00:00.000Z",
					}),
				},
			},
			{
				...current,
				brandOwner: "Current Brand",
				fieldProvenance: {
					brandOwner: fieldSource("source-verified", {
						observedAt: "2026-01-01T00:00:00.000Z",
					}),
				},
			},
		);

		expect(result.brandOwner).toBe("Current Brand");
		expect(result.sourceEnrichmentDecisions).toContainEqual(expect.objectContaining({
			field: "brandOwner",
			reason: "newer-observation",
		}));
	});

	it("preserves an explicitly reported zero against equal source evidence", () => {
		const result = enrichListFoodWithExactSourceEvidence(
			{
				...current,
				foodNutrients: [nutrient(1004, 0)],
				reportedNutrientIds: [1004],
			},
			{
				...current,
				foodNutrients: [nutrient(1004, 5)],
				reportedNutrientIds: [1004],
			},
		);

		expect(result.foodNutrients).toEqual([
			expect.objectContaining({
				nutrientId: 1004,
				value: 0,
				valueStatus: "reported-zero",
			}),
		]);
		expect(result.reportedNutrientIds).toEqual([1004]);
	});
});
