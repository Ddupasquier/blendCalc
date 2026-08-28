import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/svelte";
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
		expect(selectionButton).not.toContainElement(
			selectionIndicator as HTMLElement,
		);
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
					preferenceWarnings: [
						{
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
						},
					],
				},
				selected: true,
				onSelect: vi.fn(),
			},
		});

		const selectionButton = screen.getByRole("button", {
			name: /remove pork chorizo from this mix\. warning:/i,
		});
		expect(selectionButton).toHaveAttribute("aria-pressed", "true");
		expect(
			container.querySelector(".ingredient-card-media-lane"),
		).toBeInTheDocument();
		expect(container.querySelector(".card-warning-frame")).toBeInTheDocument();
	});

	it("keeps recall danger framing above selected styling", () => {
		const { container } = render(MixIngredientOption, {
			props: {
				food: {
					...food,
					safetyAlerts: [
						{
							id: "recall-alert",
							providerKey: "open-fda-food-enforcement",
							sourceName: "openFDA Food Enforcement",
							sourceAttribution: "U.S. Food and Drug Administration",
							alertType: "recall",
							status: "Ongoing",
							productDescription: "Recalled pork chorizo",
							sourceUrl: "https://api.fda.gov/food/enforcement.json",
							matchType: "exact_gtin",
							requiresPackageCheck: false,
							detectedAt: "2026-08-25T12:00:00.000Z",
						},
					],
				},
				selected: true,
				onSelect: vi.fn(),
			},
		});

		const card = container.querySelector(".mix-ingredient-option");
		expect(card).toHaveClass("mix-ingredient-option--selected");
		expect(card).toHaveClass("mix-ingredient-option--warning");
		expect(card).toHaveAttribute("data-warning-tone", "danger");
		expect(container.querySelector(".card-warning-frame")).toHaveAttribute(
			"data-tone",
			"danger",
		);
		expect(
			screen.getByRole("button", {
				name: /active official recall/i,
			}),
		).toHaveAttribute("aria-pressed", "true");
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
