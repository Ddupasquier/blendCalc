import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FdcFood } from "$lib/utils/food/types";

vi.mock("$lib/utils/food/fdc", () => ({
	FdcConfigurationError: class FdcConfigurationError extends Error {},
	searchFoods: vi.fn().mockResolvedValue([]),
}));

vi.mock("$lib/utils/food/customFoods", async (importOriginal) => {
	const actual = await importOriginal<typeof import("$lib/utils/food/customFoods")>();
	return {
		...actual,
		searchCustomFoods: vi.fn().mockReturnValue([]),
	};
});

vi.mock("$lib/utils/products/catalog", () => ({
	searchSharedProducts: vi.fn().mockResolvedValue([]),
}));

import IngredientSearch from "$lib/components/ingredients/search/IngredientSearch.svelte";
import { searchFoods } from "$lib/utils/food/fdc";

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

		await fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		await fireEvent.keyDown(searchInput, { key: "Enter" });

		expect(onSelect).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: 102 }),
		);
	});
});
