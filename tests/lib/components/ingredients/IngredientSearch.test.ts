import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import IngredientSearch from "$lib/components/ingredients/IngredientSearch.svelte";

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

		const searchInput = screen.getByRole("searchbox", {
			name: /search ingredients/i,
		});

		await fireEvent.focus(searchInput);
		await fireEvent.input(searchInput, { target: { value: "banana" } });

		expect(onSearchFocus).toHaveBeenCalledTimes(2);
	});
});
