import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";

vi.mock("$lib/utils/food/sources/fdc", () => ({
	FdcConfigurationError: class FdcConfigurationError extends Error {},
	searchFoodPage: vi.fn().mockResolvedValue({
		foods: [],
		hasMore: false,
		nextOffset: null,
		total: 0,
	}),
}));

vi.mock("$lib/utils/products/catalog", () => ({
	searchSharedProducts: vi.fn().mockResolvedValue([]),
}));

import IngredientSearch from "$lib/components/ingredients/search/IngredientSearch/IngredientSearch.svelte";
import { searchFoodPage } from "$lib/utils/food/sources/fdc";
import type { IngredientSearchPage } from "$lib/utils/ingredients/ingredientSearchPagination";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceCatalogs";

const makeFood = (fdcId: number, description: string): FoodItem => ({
	fdcId,
	description,
	foodCategory: "Fruit",
	foodNutrients: [],
	dataType: "SR Legacy",
});

const makePage = (
	foods: FoodItem[],
	options: Partial<Omit<IngredientSearchPage, "foods">> = {},
): IngredientSearchPage => ({
	foods,
	hasMore: options.hasMore ?? false,
	nextOffset: options.nextOffset ?? null,
	total: options.total ?? foods.length,
});

describe("IngredientSearch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("notifies parent when the user starts using search", async () => {
		const onSearchFocus = vi.fn();

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onSearchFocus,
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});

		await fireEvent.focus(searchInput);
		await fireEvent.input(searchInput, { target: { value: "banana" } });

		expect(onSearchFocus).toHaveBeenCalledTimes(2);
	});

	it("explains a completed search with no matches and clears the notice for new results", async () => {
		vi.mocked(searchFoodPage)
			.mockResolvedValueOnce(makePage([]))
			.mockResolvedValueOnce(makePage([makeFood(100, "Spinach, raw")]));

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, {
			target: { value: "not-a-real-ingredient" },
		});

		expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();
		await waitFor(
			() => {
				expect(screen.getByRole("status")).toHaveTextContent("Nothing found");
				expect(screen.getByRole("status")).toHaveTextContent(
					"not-a-real-ingredient",
				);
			},
			{ timeout: 2000 },
		);

		await fireEvent.input(searchInput, { target: { value: "spinach" } });
		expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();
		await waitFor(
			() => expect(screen.getByText("Spinach, raw")).toBeInTheDocument(),
			{ timeout: 2000 },
		);
		expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();
	});

	it("keeps a failed search distinct from a completed search with no matches", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		vi.mocked(searchFoodPage).mockRejectedValueOnce(
			new Error("provider failed"),
		);

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onSearchFocus: vi.fn(),
			},
		});

		await fireEvent.input(
			screen.getByRole("combobox", { name: /search ingredients/i }),
			{ target: { value: "spinach" } },
		);

		await waitFor(
			() =>
				expect(screen.getByRole("alert")).toHaveTextContent(
					"We couldn't search foods right now",
				),
			{ timeout: 2000 },
		);
		expect(screen.queryByText("Nothing found")).not.toBeInTheDocument();
		consoleError.mockRestore();
	});

	it("uses arrow keys and Enter to select a visible result", async () => {
		const onSelect = vi.fn();
		vi.mocked(searchFoodPage).mockResolvedValueOnce(
			makePage([makeFood(101, "Apple, raw"), makeFood(102, "Banana, raw")]),
		);

		render(IngredientSearch, {
			props: {
				onSelect,
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});

		await fireEvent.input(searchInput, { target: { value: "raw" } });

		await waitFor(
			() => {
				expect(screen.getByText("Apple, raw")).toBeInTheDocument();
				expect(screen.getByText("↑↓ choose result")).toBeInTheDocument();
				expect(screen.queryByText(/backspace|⌫/i)).not.toBeInTheDocument();
			},
			{ timeout: 2000 },
		);

		expect(screen.getByRole("row", { name: /apple, raw/i })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		await fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		const firstOption = screen.getByRole("row", { name: /apple, raw/i });
		expect(firstOption).toHaveAttribute("aria-selected", "true");
		expect(firstOption.closest(".ingredient-search-card")).toHaveClass(
			"ingredient-search-card--active",
		);
		expect(searchInput).toHaveAttribute(
			"aria-activedescendant",
			"ingredient-search-result-101",
		);
		await fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		const secondOption = screen.getByRole("row", { name: /banana, raw/i });
		expect(secondOption).toHaveAttribute("aria-selected", "true");
		expect(secondOption.closest(".ingredient-search-card")).toHaveClass(
			"ingredient-search-card--active",
		);
		expect(firstOption).toHaveAttribute("aria-selected", "false");
		await fireEvent.keyDown(searchInput, { key: "Enter" });

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: 102 }),
		);
	});

	it("wraps keyboard navigation upward without using old shortcut keys", async () => {
		const onSelect = vi.fn();
		vi.mocked(searchFoodPage).mockResolvedValueOnce(
			makePage([
				makeFood(201, "Apricot, raw"),
				makeFood(202, "Cherry, raw"),
				makeFood(203, "Tomato, raw"),
			]),
		);

		render(IngredientSearch, {
			props: {
				onSelect,
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});

		await fireEvent.input(searchInput, { target: { value: "raw" } });

		await waitFor(
			() => {
				expect(screen.getByText("Apricot, raw")).toBeInTheDocument();
				expect(screen.getByText("↵ view nutrition")).toBeInTheDocument();
			},
			{ timeout: 2000 },
		);

		await fireEvent.keyDown(searchInput, { key: "ArrowUp" });
		expect(screen.getByRole("row", { name: /tomato, raw/i })).toHaveAttribute(
			"aria-selected",
			"true",
		);

		await fireEvent.keyDown(searchInput, { key: " " });
		await fireEvent.keyDown(searchInput, { key: "Backspace" });
		expect(onSelect).not.toHaveBeenCalled();

		await fireEvent.keyDown(searchInput, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: 203 }),
		);
	});

	it("uses the result plus button for adding without opening nutrition", async () => {
		const onSelect = vi.fn();
		const onAdd = vi.fn();
		vi.mocked(searchFoodPage).mockResolvedValueOnce(
			makePage([makeFood(301, "Spinach, raw")]),
		);

		render(IngredientSearch, {
			props: {
				onSelect,
				onAdd,
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});

		await fireEvent.input(searchInput, { target: { value: "spinach" } });

		await waitFor(
			() => {
				expect(screen.getByText("Spinach, raw")).toBeInTheDocument();
			},
			{ timeout: 2000 },
		);

		await fireEvent.click(
			screen.getByRole("button", { name: /add spinach, raw to fridge/i }),
		);

		expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ fdcId: 301 }));
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("cancels a pending refined search when an existing result is selected", async () => {
		const onSelect = vi.fn();
		vi.mocked(searchFoodPage).mockResolvedValueOnce(
			makePage([makeFood(302, "Spinach, raw")]),
		);

		render(IngredientSearch, {
			props: {
				onSelect,
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, { target: { value: "spin" } });
		await waitFor(
			() => expect(screen.getByText("Spinach, raw")).toBeInTheDocument(),
			{ timeout: 2000 },
		);

		await fireEvent.input(searchInput, { target: { value: "spinach" } });
		await fireEvent.click(
			screen.getByRole("button", { name: /view nutrition for spinach, raw/i }),
		);
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: 302 }),
		);
		expect(searchFoodPage).toHaveBeenCalledTimes(1);
	});

	it("uses product images and warning frames without changing search actions", async () => {
		const onSelect = vi.fn();
		const onAdd = vi.fn();
		const imageFood: FoodItem = {
			...makeFood(303, "Peanut Butter, Smooth"),
			image: {
				source: "open-food-facts",
				role: "front",
				imageUrl: "https://images.example.com/peanut-butter.jpg",
				licenseName: "CC BY-SA",
				confidence: "source-verified",
			},
			preferenceWarnings: [
				{
					id: "peanut-warning",
					level: "warning",
					category: "allergen",
					label: "Peanut",
					code: "FOOD_ALLERGEN_CONTAINS",
					params: { factLabel: "Peanut" },
				},
			],
		};
		vi.mocked(searchFoodPage).mockResolvedValueOnce(makePage([imageFood]));

		const { container } = render(IngredientSearch, {
			props: {
				onSelect,
				onAdd,
				onSearchFocus: vi.fn(),
			},
		});
		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, { target: { value: "peanut butter" } });
		await waitFor(
			() =>
				expect(screen.getByText("Peanut Butter, Smooth")).toBeInTheDocument(),
			{ timeout: 2000 },
		);

		const card = screen.getByRole("row", {
			name: /peanut butter, smooth.*warning/i,
		});
		expect(card).toHaveClass("ingredient-search-card--media");
		expect(card.querySelector(".card-warning-frame")).toBeInTheDocument();
		expect(
			card.querySelector(".ingredient-card-media-lane img"),
		).toHaveAttribute("src", "https://images.example.com/peanut-butter.jpg");
		expect(
			card.querySelector(".ingredient-search-card__icon"),
		).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", {
				name: /add peanut butter, smooth to fridge/i,
			}),
		);
		expect(onAdd).toHaveBeenCalledWith(imageFood);
		expect(onSelect).not.toHaveBeenCalled();
		expect(container.querySelector(".result-card")).not.toBeInTheDocument();
	});

	it("keeps provider identity off compact cards while retaining evidence status", async () => {
		const foods: FoodItem[] = [
			{
				...makeFood(305, "Spinach, Raw"),
				sourceKey: "usda",
				sourceLabel: "USDA FoodData Central",
				sourceDataType: "SR Legacy",
				trustStatus: "source-verified",
			},
			{
				...makeFood(306, "Spinach, Baby, Raw"),
				sourceKey: "usda",
				sourceLabel: "USDA FoodData Central",
				sourceDataType: "Foundation",
				trustStatus: "source-verified",
			},
		];
		vi.mocked(searchFoodPage).mockResolvedValueOnce(makePage(foods));

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onAdd: vi.fn(),
				onSearchFocus: vi.fn(),
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});
		await fireEvent.input(
			screen.getByRole("combobox", { name: /search ingredients/i }),
			{ target: { value: "spinach raw" } },
		);
		await waitFor(
			() => expect(screen.getByText("Spinach, Baby, Raw")).toBeInTheDocument(),
			{ timeout: 2000 },
		);

		expect(screen.queryByText("USDA")).not.toBeInTheDocument();
		expect(screen.queryByText("USDA FoodData Central")).not.toBeInTheDocument();
		expect(screen.queryByText("SR Legacy")).not.toBeInTheDocument();
		expect(screen.queryByText("Foundation")).not.toBeInTheDocument();
		expect(screen.queryByText("Imported")).not.toBeInTheDocument();
		expect(
			screen.getAllByLabelText("Verification status: Verified"),
		).toHaveLength(2);
	});

	it("uses the full-height feature lane for fallback symbols", async () => {
		const fallbackFood = makeFood(304, "Spinach, Raw");
		vi.mocked(searchFoodPage).mockResolvedValueOnce(makePage([fallbackFood]));

		const { container } = render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onAdd: vi.fn(),
				onSearchFocus: vi.fn(),
			},
		});
		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, { target: { value: "spinach" } });
		await waitFor(
			() => expect(screen.getByText("Spinach, Raw")).toBeInTheDocument(),
			{ timeout: 2000 },
		);

		const card = screen.getByRole("row", { name: /spinach, raw/i });
		expect(card).toHaveClass("ingredient-search-card--media");
		expect(
			card.querySelector(
				".ingredient-card-media__fallback .food-symbol__fallback",
			),
		).toBeInTheDocument();
		expect(
			container.querySelector(".circular-media-frame"),
		).not.toBeInTheDocument();
	});

	it("identifies a result already saved in the destination list", async () => {
		vi.mocked(searchFoodPage).mockResolvedValueOnce(
			makePage([makeFood(302, "Kale, raw")]),
		);

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onAdd: vi.fn(),
				onSearchFocus: vi.fn(),
				destinationListFoodIdentityKeys: new Set(["fdc:302"]),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, { target: { value: "kale" } });

		await waitFor(
			() => expect(screen.getByText("Kale, raw")).toBeInTheDocument(),
			{ timeout: 2000 },
		);

		expect(
			screen.queryByRole("button", { name: /add kale, raw to fridge/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", {
				name: /view nutrition for kale, raw, already in fridge/i,
			}),
		).toBeInTheDocument();
	});

	it("waits for mobile text composition before searching", async () => {
		vi.mocked(searchFoodPage).mockResolvedValueOnce(
			makePage([makeFood(401, "Kiwi fruit, raw")]),
		);

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		expect(searchInput).toHaveAttribute("inputmode", "search");
		expect(searchInput).toHaveAttribute("enterkeyhint", "search");

		await fireEvent.compositionStart(searchInput);
		await fireEvent.input(searchInput, { target: { value: "kiwi" } });
		expect(searchFoodPage).not.toHaveBeenCalled();

		await fireEvent.compositionEnd(searchInput);
		await waitFor(
			() =>
				expect(searchFoodPage).toHaveBeenCalledWith("kiwi", {
					offset: 0,
					limit: 15,
					sourceFilter: "all",
					trustFilter: "any",
					signal: expect.any(AbortSignal),
				}),
			{ timeout: 2000 },
		);
	});

	it("loads another page only from the explicit control and offers return to top", async () => {
		vi.mocked(searchFoodPage)
			.mockResolvedValueOnce(
				makePage(
					[makeFood(501, "Tomato, roma"), makeFood(502, "Tomatoes, raw")],
					{ hasMore: true, nextOffset: 2, total: 3 },
				),
			)
			.mockResolvedValueOnce(
				makePage([makeFood(503, "Green tomatoes")], { total: 3 }),
			);

		const { container } = render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onSearchFocus: vi.fn(),
			},
		});
		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, { target: { value: "tomato" } });
		await waitFor(
			() => expect(screen.getByText("Tomato, roma")).toBeInTheDocument(),
			{ timeout: 2000 },
		);
		expect(screen.getByRole("button", { name: "Load more" })).toBeVisible();

		const resultsPanel = container.querySelector<HTMLElement>(".results-panel");
		expect(resultsPanel).not.toBeNull();
		const scrollTo = vi.fn();
		Object.defineProperties(resultsPanel!, {
			scrollHeight: { configurable: true, value: 600 },
			scrollTop: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 },
			scrollTo: { configurable: true, value: scrollTo },
		});

		await fireEvent.scroll(resultsPanel!);
		expect(searchFoodPage).toHaveBeenCalledTimes(1);

		await fireEvent(window, new Event("resize"));
		expect(screen.getByRole("button", { name: "Return to top" })).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		await waitFor(() => {
			expect(screen.getByText("Green tomatoes")).toBeInTheDocument();
		});
		expect(searchFoodPage).toHaveBeenNthCalledWith(2, "tomato", {
			offset: 2,
			limit: 15,
			sourceFilter: "all",
			trustFilter: "any",
			signal: expect.any(AbortSignal),
		});

		const returnButton = await screen.findByRole("button", {
			name: "Return to top",
		});
		await fireEvent.click(returnButton);
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("aborts a superseded search before requesting the new query", async () => {
		let firstRequestSignal: AbortSignal | undefined;
		vi.mocked(searchFoodPage)
			.mockImplementationOnce((_query, options) => {
				firstRequestSignal = options?.signal;
				return new Promise((_resolve, reject) => {
					firstRequestSignal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				});
			})
			.mockResolvedValueOnce(makePage([makeFood(601, "Tomatoes, raw")]));

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onSearchFocus: vi.fn(),
			},
		});

		const searchInput = screen.getByRole("combobox", {
			name: /search ingredients/i,
		});
		await fireEvent.input(searchInput, { target: { value: "tomato" } });
		await waitFor(() => expect(searchFoodPage).toHaveBeenCalledTimes(1), {
			timeout: 2000,
		});

		await fireEvent.input(searchInput, { target: { value: "tomatoes" } });
		expect(firstRequestSignal?.aborted).toBe(true);
		await waitFor(() => expect(searchFoodPage).toHaveBeenCalledTimes(2), {
			timeout: 2000,
		});
	});
});
