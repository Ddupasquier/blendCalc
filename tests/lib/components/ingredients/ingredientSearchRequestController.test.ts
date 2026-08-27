import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";

const searchFoodPage = vi.hoisted(() => vi.fn());

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$lib/utils/food/sources/fdc", () => ({ searchFoodPage }));

import { createIngredientSearchRequestController } from "$lib/components/ingredients/search/IngredientSearch/ingredientSearchRequestController.svelte";

const food = (fdcId: number, description: string): FoodItem => ({
	fdcId,
	description,
	foodNutrients: [],
});

describe("createIngredientSearchRequestController", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("debounces a search and records its pagination state", async () => {
		searchFoodPage.mockResolvedValue({
			foods: [food(1, "Apple, raw")],
			hasMore: true,
			nextOffset: 1,
			total: 2,
		});
		const onResultsChanged = vi.fn();
		const controller = createIngredientSearchRequestController({
			getSourceFilter: () => "all",
			getTrustFilter: () => "any",
			onResultsChanged,
		});
		controller.activate();
		controller.state.query = "apple";
		controller.triggerSearch();

		expect(searchFoodPage).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(500);

		expect(searchFoodPage).toHaveBeenCalledWith(
			"apple",
			expect.objectContaining({
				offset: 0,
				sourceFilter: "all",
				trustFilter: "any",
			}),
		);
		expect(controller.state.results).toEqual([food(1, "Apple, raw")]);
		expect(controller.state.hasMoreResults).toBe(true);
		expect(controller.state.nextOffset).toBe(1);
		expect(controller.state.completedQuery).toBe("apple");
		expect(onResultsChanged).toHaveBeenCalledWith(
			[food(1, "Apple, raw")],
			"apple",
		);
	});

	it("appends a later result page without replacing prior results", async () => {
		searchFoodPage
			.mockResolvedValueOnce({
				foods: [food(1, "Apple, raw")],
				hasMore: true,
				nextOffset: 1,
				total: 2,
			})
			.mockResolvedValueOnce({
				foods: [food(2, "Apple, dried")],
				hasMore: false,
				nextOffset: null,
				total: 2,
			});
		const controller = createIngredientSearchRequestController({
			getSourceFilter: () => "all",
			getTrustFilter: () => "any",
			onResultsChanged: vi.fn(),
		});
		controller.activate();
		controller.state.query = "apple";
		controller.triggerSearch();
		await vi.advanceTimersByTimeAsync(500);

		await controller.loadMoreResults();

		expect(searchFoodPage).toHaveBeenLastCalledWith(
			"apple",
			expect.objectContaining({ offset: 1 }),
		);
		expect(controller.state.results).toEqual([
			food(1, "Apple, raw"),
			food(2, "Apple, dried"),
		]);
		expect(controller.state.hasMoreResults).toBe(false);
	});

	it("reruns the active query when filters change", async () => {
		let sourceFilter = "all";
		searchFoodPage.mockResolvedValue({
			foods: [],
			hasMore: false,
			nextOffset: null,
			total: 0,
		});
		const controller = createIngredientSearchRequestController({
			getSourceFilter: () => sourceFilter,
			getTrustFilter: () => "any",
			onResultsChanged: vi.fn(),
		});
		controller.synchronizeFilters("all:any");
		controller.activate();
		controller.state.query = "apple";
		controller.triggerSearch();
		await vi.advanceTimersByTimeAsync(500);

		sourceFilter = "shared";
		controller.synchronizeFilters("shared:any");
		await vi.advanceTimersByTimeAsync(500);

		expect(searchFoodPage).toHaveBeenCalledTimes(2);
		expect(searchFoodPage).toHaveBeenLastCalledWith(
			"apple",
			expect.objectContaining({ sourceFilter: "shared" }),
		);
	});

	it("cancels pending work and clears all visible request state", async () => {
		searchFoodPage.mockResolvedValue({
			foods: [food(1, "Apple, raw")],
			hasMore: false,
			nextOffset: null,
			total: 1,
		});
		const controller = createIngredientSearchRequestController({
			getSourceFilter: () => "all",
			getTrustFilter: () => "any",
			onResultsChanged: vi.fn(),
		});
		controller.activate();
		controller.state.query = "apple";
		controller.triggerSearch();
		controller.clearSearch();
		await vi.advanceTimersByTimeAsync(500);

		expect(searchFoodPage).not.toHaveBeenCalled();
		expect(controller.state).toEqual(
			expect.objectContaining({
				query: "",
				results: [],
				loading: false,
				loadingMore: false,
				hasMoreResults: false,
				nextOffset: null,
				error: "",
				completedQuery: "",
			}),
		);
	});
});
