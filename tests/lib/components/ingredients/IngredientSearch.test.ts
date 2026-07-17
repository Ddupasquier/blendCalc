import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FdcFood } from "$lib/utils/food/types";

vi.mock("$lib/utils/food/sources/fdc", () => ({
	FdcConfigurationError: class FdcConfigurationError extends Error {},
	searchFoods: vi.fn().mockResolvedValue([]),
}));

vi.mock("$lib/utils/food/custom/customFoods", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/food/custom/customFoods")>();
	return {
		...actual,
		searchCustomFoods: vi.fn().mockReturnValue([]),
	};
});

vi.mock("$lib/utils/products/catalog", () => ({
	searchSharedProducts: vi.fn().mockResolvedValue([]),
}));

import IngredientSearch from "$lib/components/ingredients/search/IngredientSearch.svelte";
import { searchFoods } from "$lib/utils/food/sources/fdc";

const makeFood = (fdcId: number, description: string): FdcFood => ({
	fdcId,
	description,
	foodCategory: "Fruit",
	foodNutrients: [],
	dataType: "SR Legacy",
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

	it("uses arrow keys and Enter to select a visible result", async () => {
		const onSelect = vi.fn();
		vi.mocked(searchFoods).mockResolvedValueOnce([
			makeFood(101, "Apple, raw"),
			makeFood(102, "Banana, raw"),
		]);

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
		expect(firstOption).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(firstOption.closest(".result-card")).toHaveClass(
			"result-card--active",
		);
		expect(searchInput).toHaveAttribute(
			"aria-activedescendant",
			"ingredient-search-result-101",
		);
		await fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		const secondOption = screen.getByRole("row", { name: /banana, raw/i });
		expect(secondOption).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(secondOption.closest(".result-card")).toHaveClass(
			"result-card--active",
		);
		expect(firstOption).toHaveAttribute("aria-selected", "false");
		await fireEvent.keyDown(searchInput, { key: "Enter" });

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: 102 }),
		);
	});

	it("wraps keyboard navigation upward without using old shortcut keys", async () => {
		const onSelect = vi.fn();
		vi.mocked(searchFoods).mockResolvedValueOnce([
			makeFood(201, "Apricot, raw"),
			makeFood(202, "Cherry, raw"),
			makeFood(203, "Tomato, raw"),
		]);

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
		vi.mocked(searchFoods).mockResolvedValueOnce([
			makeFood(301, "Spinach, raw"),
		]);

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

	it("hides the add button when a result is already saved", async () => {
		vi.mocked(searchFoods).mockResolvedValueOnce([
			makeFood(302, "Kale, raw"),
		]);

		render(IngredientSearch, {
			props: {
				onSelect: vi.fn(),
				onAdd: vi.fn(),
				onSearchFocus: vi.fn(),
				savedFoodIdentityKeys: new Set(["fdc:302"]),
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
				name: /view nutrition for kale, raw, already in fridge or shopping list/i,
			}),
		).toBeInTheDocument();
	});

	it("waits for mobile text composition before searching", async () => {
		vi.mocked(searchFoods).mockResolvedValueOnce([
			makeFood(401, "Kiwi fruit, raw"),
		]);

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
		expect(searchFoods).not.toHaveBeenCalled();

		await fireEvent.compositionEnd(searchInput);
		await waitFor(() => expect(searchFoods).toHaveBeenCalledWith("kiwi"), {
			timeout: 2000,
		});
	});
});
