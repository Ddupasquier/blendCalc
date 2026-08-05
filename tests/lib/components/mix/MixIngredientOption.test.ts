import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import MixIngredientOption from "$lib/components/mix/ingredients/MixIngredientOption/MixIngredientOption.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const food: FdcFood = {
	fdcId: 1,
	description: "Pork Chorizo",
	foodCategory: "Sausages, Hotdogs & Brats",
	foodNutrients: [],
};

describe("MixIngredientOption", () => {
	it("uses the whole card as the only selection action", async () => {
		const onSelect = vi.fn();
		const { container } = render(MixIngredientOption, {
			props: { food, selected: false, onSelect },
		});

		await fireEvent.click(
			screen.getByRole("button", { name: /add pork chorizo to this mix/i }),
		);
		expect(onSelect).toHaveBeenCalledOnce();
		const selectionButton = screen.getByRole("button", {
			name: /add pork chorizo to this mix/i,
		});
		const selectionIndicator = container.querySelector(
			".card-selection-indicator",
		) as HTMLElement;
		expect(selectionButton).toContainElement(selectionIndicator);
		await fireEvent.click(selectionIndicator);
		expect(onSelect).toHaveBeenCalledTimes(2);
		expect(
			screen.queryByRole("button", { name: /rename pork chorizo/i }),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Sausages, Hotdogs & Brats")).not.toBeInTheDocument();
	});

	it("exposes selected state and warning context through the card action", () => {
		const { container } = render(MixIngredientOption, {
			props: {
				food: {
					...food,
					preferenceWarnings: [{
						id: "preference-warning",
						level: "warning",
						category: "restriction",
						label: "Pork",
						code: "FOOD_RESTRICTION_CONFLICT",
						params: {
							factLabel: "Pork",
							restrictionLabel: "Vegan",
							evidenceType: "intrinsic",
						},
					}],
				},
				selected: true,
				onSelect: vi.fn(),
			},
		});

		const selectionButton = screen.getByRole("button", {
			name: /remove pork chorizo from this mix\. warning:/i,
		});
		expect(selectionButton).toHaveAttribute("aria-pressed", "true");
		expect(container.querySelector(".ingredient-card-media-lane")).toBeInTheDocument();
		expect(container.querySelector(".card-warning-edge")).toBeInTheDocument();
	});
});
