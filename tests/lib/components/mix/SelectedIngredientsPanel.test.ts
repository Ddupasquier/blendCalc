import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SelectedIngredientsPanel from "$lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";

const food = (fdcId: number): FdcFood => ({
	fdcId,
	description: `Selected ingredient ${String(fdcId).padStart(2, "0")}`,
	foodNutrients: [],
});

const conversion: ServingConversion = {
	grams: 100,
	milliliters: null,
	dimension: "weight",
	density: null,
	available: true,
	warning: null,
	method: "source-reported",
	basis: "package serving",
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SelectedIngredientsPanel progressive loading", () => {
	it("keeps visible cards mounted while appending the remaining selection", async () => {
		const selectedFoods = Array.from({ length: 8 }, (_, index) => food(index + 1));
		render(SelectedIngredientsPanel, {
			props: {
				selectedFoods,
				fridgeItems: selectedFoods,
				selectedNutrients: [],
				servingGrams: {},
				getServingQuantity: () => 100,
				getServingUnit: () => "g",
				getServingConversion: () => conversion,
				getServingConversionWarning: () => null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(screen.getByText("Selected ingredient 01")).toBeInTheDocument();
		expect(screen.getByText("Selected ingredient 06")).toBeInTheDocument();
		expect(screen.queryByText("Selected ingredient 07")).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: "Load more selected ingredients" }),
		);

		expect(screen.getByText("Selected ingredient 01")).toBeInTheDocument();
		expect(screen.getByText("Selected ingredient 07")).toBeInTheDocument();
		expect(screen.getByText("Selected ingredient 08")).toBeInTheDocument();
	});

	it("reports upward scrolling before the selected list reaches the top", async () => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		const selectedFoods = Array.from({ length: 8 }, (_, index) => food(index + 1));
		const onScrollDirectionChange = vi.fn();
		render(SelectedIngredientsPanel, {
			props: {
				selectedFoods,
				fridgeItems: selectedFoods,
				selectedNutrients: [],
				servingGrams: {},
				getServingQuantity: () => 100,
				getServingUnit: () => "g",
				getServingConversion: () => conversion,
				getServingConversionWarning: () => null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
				onScrollDirectionChange,
			},
		});

		const list = screen.getByLabelText("Selected Mix ingredients");
		let scrollTop = 0;
		Object.defineProperty(list, "scrollTop", {
			configurable: true,
			get: () => scrollTop,
		});

		scrollTop = 30;
		await fireEvent.scroll(list);
		scrollTop = 15;
		await fireEvent.scroll(list);

		expect(onScrollDirectionChange).toHaveBeenNthCalledWith(1, "down");
		expect(onScrollDirectionChange).toHaveBeenNthCalledWith(2, "up");
	});
});
