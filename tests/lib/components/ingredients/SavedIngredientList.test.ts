import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedIngredientList from "$lib/components/ingredients/list/SavedIngredientList.svelte";
import type { FdcFood } from "$lib/utils/food/types";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";

const food: FdcFood = {
	fdcId: 1,
	description: "Spinach, raw",
	foodCategory: "Vegetables",
	foodNutrients: [],
};

describe("SavedIngredientList overlay behavior", () => {
	it("does not reveal more items while an overlay is open", async () => {
		const onRevealMore = vi.fn();

		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				canRevealMore: true,
				revealPaused: true,
				onSelectAll: vi.fn(),
				onClearSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore,
			},
		});

		const list = screen.getByRole("list", { name: "Fridge ingredients" });
		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 500 },
			scrollTop: { configurable: true, value: 400 },
			clientHeight: { configurable: true, value: 100 },
		});

		await fireEvent.scroll(list);

		expect(onRevealMore).not.toHaveBeenCalled();
	});
});
