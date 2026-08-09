import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import MixIngredientOption from "$lib/components/mix/ingredients/MixIngredientOption/MixIngredientOption.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const food: FoodItem = {
	fdcId: 1,
	description: "Pork Chorizo",
	foodCategory: "Sausages, Hotdogs & Brats",
	foodNutrients: [],
};

const optionStyles = readFileSync(
	"src/lib/components/mix/ingredients/MixIngredientOption/MixIngredientOption.scss",
	"utf8",
);
const cardLayoutStyles = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMediaLane/_IngredientCardLayout.scss",
	"utf8",
);

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
		expect(selectionButton).not.toContainElement(selectionIndicator);
		await fireEvent.click(selectionButton);
		expect(onSelect).toHaveBeenCalledTimes(2);
		expect(
			screen.queryByRole("button", { name: /rename pork chorizo/i }),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Sausages, Hotdogs & Brats")).not.toBeInTheDocument();
	});

	it("reserves a separate layout column so long names cannot overlap selection", () => {
		const description =
			"Oscar Mayer, Wieners (Beef Franks), Extra Long Product Description";
		const { container } = render(MixIngredientOption, {
			props: {
				food: { ...food, description },
				selected: true,
				onSelect: vi.fn(),
			},
		});

		const card = container.querySelector(".mix-ingredient-option");
		const selectionButton = screen.getByRole("button", {
			name: /remove oscar mayer.*from this mix/i,
		});
		const selectionIndicator = container.querySelector(
			".mix-ingredient-option__select-status",
		);
		const name = screen.getByText(description);
		const selectionStatusRules = optionStyles.match(
			/\.mix-ingredient-option__select-status\s*\{([\s\S]*?)\}/,
		)?.[1];
		const selectionIndicatorLayoutRules = cardLayoutStyles.match(
			/@mixin selection-indicator-layer\s*\{([\s\S]*?)\n\}/,
		)?.[1];

		expect(card).toContainElement(selectionIndicator as HTMLElement);
		expect(selectionButton).not.toContainElement(selectionIndicator as HTMLElement);
		expect(name).toHaveAttribute("title", description);
		expect(optionStyles).toContain(
			"@include ingredient-card-layout.selection-layout",
		);
		expect(cardLayoutStyles).toMatch(
			/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/,
		);
		expect(selectionStatusRules).toContain(
			"@include ingredient-card-layout.selection-indicator-layer",
		);
		expect(selectionIndicatorLayoutRules).toContain("justify-self: end");
		expect(selectionIndicatorLayoutRules).not.toContain("position: absolute");
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

	it("keeps private-custom classification out of compact card badges", () => {
		render(MixIngredientOption, {
			props: {
				food: { ...food, customFood: true },
				selected: false,
				onSelect: vi.fn(),
			},
		});

		expect(screen.queryByText("Custom")).not.toBeInTheDocument();
	});
});
