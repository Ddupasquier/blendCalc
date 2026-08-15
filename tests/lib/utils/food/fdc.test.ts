import { afterEach, describe, expect, it, vi } from "vitest";
import {
	normalizeFdcFood,
	searchFoodPage,
} from "$lib/utils/food/sources/fdc";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("FoodData Central normalization", () => {
	it("normalizes full food-detail nutrient records", () => {
		const food = normalizeFdcFood({
			fdcId: 123,
			description: "DETAILED PRODUCT",
			brandOwner: "",
			brandName: "Example Brand",
			packageWeight: "24 oz",
			marketCountry: "United States",
			publicationDate: "7/17/2024",
			availableDate: "2024-07-18",
			modifiedDate: "2024-08-01T12:30:00Z",
			discontinuedDate: "invalid date",
			foodNutrients: [
				{
					amount: 42,
					nutrient: {
						id: 1092,
						name: "Potassium, K",
						number: "306",
						unitName: "mg",
					},
				},
			],
		});

		expect(food.description).toBe("Detailed Product");
		expect(food.nameProvenance).toBe("source");
		expect(food.brandOwner).toBe("Example Brand");
		expect(food.packageQuantity).toEqual({ label: "24 oz" });
		expect(food.sourceMetadata).toEqual({
			publishedAt: "2024-07-17T00:00:00.000Z",
			availableAt: "2024-07-18T00:00:00.000Z",
			modifiedAt: "2024-08-01T12:30:00.000Z",
			marketCountries: ["United States"],
		});
		expect(food.fieldProvenance).toMatchObject({
			productName: { source: "usda", sourceReference: "123" },
			brandOwner: { source: "usda", sourceReference: "123" },
			nutrition: { source: "usda", sourceReference: "123" },
			sourceMetadata: { source: "usda", sourceReference: "123" },
		});
		expect(food.foodNutrients).toEqual([
			{
				nutrientId: 1092,
				nutrientName: "Potassium, K",
				nutrientNumber: "306",
				unitName: "mg",
				value: 42,
				valueOrigin: "reported",
				valueStatus: "reported",
				sourceNutrientKey: "1092",
				sourceNutrientCode: "306",
				mappingStatus: "canonical",
				mappingMethod: "source-identifier",
			},
		]);
	});

	it("preserves reported zeroes while dropping missing or invalid nutrients", () => {
		const food = normalizeFdcFood({
			fdcId: 124,
			description: "ZERO TEST PRODUCT",
			foodNutrients: [
				{
					amount: 0,
					nutrient: {
						id: 1004,
						name: "Total lipid (fat)",
						number: "204",
						unitName: "g",
					},
				},
				{
					amount: null as unknown as number,
					nutrient: {
						id: 1003,
						name: "Protein",
						number: "203",
						unitName: "g",
					},
				},
				{
					amount: 10,
					nutrient: {
						id: 1005,
						name: "",
						number: "205",
						unitName: "g",
					},
				},
			],
		});

		expect(food.foodNutrients).toEqual([
			expect.objectContaining({ nutrientId: 1004, value: 0 }),
		]);
		expect(food.reportedNutrientIds).toEqual([1004]);
	});

	it("preserves exact USDA household portion weights as serving conversions", () => {
		const food = normalizeFdcFood({
			fdcId: 171032,
			description: "Oil, apricot kernel",
			dataType: "SR Legacy",
			foodNutrients: [],
			foodPortions: [
				{
					amount: 1,
					gramWeight: 13.6,
					portionDescription: "1 tablespoon",
					sequenceNumber: 1,
				},
				{
					amount: 1,
					gramWeight: 218,
					portionDescription: "1 cup",
					sequenceNumber: 2,
				},
				{
					amount: 1,
					gramWeight: null as unknown as number,
					portionDescription: "missing weight",
					sequenceNumber: 3,
				},
			],
		});

		expect(food.hasSourceServing).toBe(true);
		expect(food.foodIdentityType).toBe("generic");
		expect(food.foodServings).toEqual([
			{
				label: "1 tablespoon",
				gramWeight: 13.6,
				amount: 1,
				unitKey: undefined,
				isPrimary: true,
				measureType: "Food portion",
				isHouseholdMeasure: true,
				sourceMeasureKey: "portion:1",
				origin: "source-household-measure",
				gramWeightMethod: "source-reported",
				source: "usda",
				sourceReference: "171032",
				confidence: "unknown",
			},
			{
				label: "1 cup",
				gramWeight: 218,
				amount: 1,
				unitKey: undefined,
				isPrimary: false,
				measureType: "Food portion",
				isHouseholdMeasure: true,
				sourceMeasureKey: "portion:2",
				origin: "source-household-measure",
				gramWeightMethod: "source-reported",
				source: "usda",
				sourceReference: "171032",
				confidence: "unknown",
			},
		]);
	});

	it("maps USDA source-owned identity types without a shared allowlist", () => {
		expect(normalizeFdcFood({
			fdcId: 200,
			description: "Branded product",
			dataType: "Branded",
			foodNutrients: [],
		}).foodIdentityType).toBe("packaged");
		expect(normalizeFdcFood({
			fdcId: 201,
			description: "Experimental generic food",
			dataType: "Experimental",
			foodNutrients: [],
		}).foodIdentityType).toBe("generic");
		expect(normalizeFdcFood({
			fdcId: 202,
			description: "Future source record",
			dataType: "Future source type",
			foodNutrients: [],
		}).foodIdentityType).toBe("unknown");
	});
});

describe("ingredient search request", () => {
	it("forwards the cancellation signal to the internal search endpoint", async () => {
		const abortController = new AbortController();
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			foods: [],
			hasMore: false,
			nextOffset: null,
			total: 0,
		}), {
			status: 200,
			headers: { "content-type": "application/json" },
		}));
		vi.stubGlobal("fetch", fetcher);

		await searchFoodPage("tomato", { signal: abortController.signal });

		expect(fetcher).toHaveBeenCalledWith(
			expect.stringContaining("/api/foods/search?q=tomato"),
			expect.objectContaining({ signal: abortController.signal }),
		);
	});
});
