import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedIngredientList from "$lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte";
import type { FdcFood } from "$lib/utils/food/types";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const food: FdcFood = {
	fdcId: 1,
	description: "Spinach, raw",
	foodCategory: "Vegetables",
	foodNutrients: [],
};

const secondFood: FdcFood = {
	fdcId: 2,
	description: "Tomato, roma",
	foodCategory: "Vegetables",
	foodNutrients: [],
};

describe("SavedIngredientList overlay behavior", () => {
	const renderList = (
		activeList: SmoothieListKey = MIX_STORAGE_KEYS.fridge,
		canRevealMore = false,
	) =>
		render(SavedIngredientList, {
			props: {
				activeList,
				foods: [food],
				canRevealMore,
				onSelectAll: vi.fn(),
				onClearSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

	it("does not auto-load on scroll and disables loading while an overlay is open", async () => {
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
		expect(
			screen.getByRole("button", { name: "Load more" }),
		).toBeDisabled();
	});

	it("requires two deliberate activations before removing an ingredient", async () => {
		const onRemove = vi.fn();

		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				onSelectAll: vi.fn(),
				onClearSelection: vi.fn(),
				onMoveSelection: vi.fn(),
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove,
				onRevealMore: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Remove Spinach, raw" }),
		);

		expect(onRemove).not.toHaveBeenCalled();
		expect(
			screen.getByText("Tap or click delete again to confirm."),
		).toBeVisible();

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Confirm deletion of Spinach, raw",
			}),
		);

		expect(onRemove).toHaveBeenCalledOnce();
		expect(onRemove).toHaveBeenCalledWith(1);
		expect(
			screen.queryByText("Tap or click delete again to confirm."),
		).not.toBeInTheDocument();
	});

	it("shows a return-to-top control only for an overflowing completed list", async () => {
		renderList();
		const list = screen.getByRole("list", { name: "Fridge ingredients" });
		const scrollTo = vi.fn();

		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 },
			scrollTo: { configurable: true, value: scrollTo },
		});

		await fireEvent(window, new Event("resize"));
		const returnButton = await screen.findByRole("button", {
			name: "Return to top",
		});
		await fireEvent.click(returnButton);

		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("does not show a return-to-top control when the list fits", async () => {
		renderList(MIX_STORAGE_KEYS.shoppingList);
		const list = screen.getByRole("list", {
			name: "Shopping List ingredients",
		});

		Object.defineProperties(list, {
			scrollHeight: { configurable: true, value: 100 },
			clientHeight: { configurable: true, value: 100 },
		});

		await fireEvent(window, new Event("resize"));

		expect(
			screen.queryByRole("button", { name: "Return to top" }),
		).not.toBeInTheDocument();
	});

	it("shows both explicit controls without auto-loading an overflowing partial list", async () => {
		const onRevealMore = vi.fn();
		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food],
				canRevealMore: true,
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
		await fireEvent(window, new Event("resize"));

		expect(onRevealMore).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Return to top" }),
		).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(onRevealMore).toHaveBeenCalledOnce();
	});

	it("runs one bulk move after every selected card begins its exit", async () => {
		const onMoveSelection = vi.fn().mockResolvedValue(true);

		render(SavedIngredientList, {
			props: {
				activeList: MIX_STORAGE_KEYS.fridge,
				foods: [food, secondFood],
				selectedIds: [food.fdcId, secondFood.fdcId],
				onSelectAll: vi.fn(),
				onClearSelection: vi.fn(),
				onMoveSelection,
				onMoveItem: vi.fn(),
				onToggle: vi.fn(),
				onPreview: vi.fn(),
				onActions: vi.fn(),
				onRemove: vi.fn(),
				onRevealMore: vi.fn(),
			},
		});

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Move 2 checked → Shopping List",
			}),
		);

		expect(onMoveSelection).toHaveBeenCalledOnce();
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Moved 2 ingredients to Shopping List.",
		);
	});
});
