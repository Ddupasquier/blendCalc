import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import IngredientCard from "$lib/components/mix/ingredients/IngredientCard/IngredientCard.svelte";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";

const cardStyles = readFileSync(
	"src/lib/components/mix/ingredients/IngredientCard/IngredientCard.scss",
	"utf8",
);

afterEach(() => configureServingMeasureCatalog(null));

describe("Mix ingredient card", () => {
	it("uses compact unit labels and keeps secondary actions out of the amount row", () => {
		configureServingMeasureCatalog({
			options: [
				{
					value: "g",
					label: "grams",
					shortLabel: "g",
					dimension: "weight",
					conversionToBase: 1,
					isDefault: true,
				},
			],
			aliases: { g: "g" },
			aliasEntries: [{ alias: "g", unit: "g" }],
		});

		const { container } = render(IngredientCard, {
			props: {
				food: {
					fdcId: 1,
					description: "Tomato, Roma",
					foodNutrients: [],
				},
				sourceLabel: "Fridge",
				quantity: 85,
				unit: "g",
				gramsLabel: "85g",
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(screen.getByRole("option", { name: "g" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "grams" })).not.toBeInTheDocument();
		expect(
			container.querySelector(".ingredient-card__actions"),
		).toContainElement(screen.getByRole("button", { name: "Remove Tomato, Roma" }));
		expect(cardStyles).toContain('". amount amount"');
		expect(cardStyles).toContain("flex-direction: row");
	});

	it("does not label private foods with a compact custom badge", () => {
		configureServingMeasureCatalog({
			options: [{
				value: "g",
				label: "grams",
				shortLabel: "g",
				dimension: "weight",
				conversionToBase: 1,
				isDefault: true,
			}],
			aliases: { g: "g" },
			aliasEntries: [{ alias: "g", unit: "g" }],
		});

		render(IngredientCard, {
			props: {
				food: {
					fdcId: 2,
					description: "Private recipe",
					foodNutrients: [],
					customFood: true,
				},
				sourceLabel: "Fridge",
				quantity: 25,
				unit: "g",
				gramsLabel: "25g",
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(screen.queryByText("Custom")).not.toBeInTheDocument();
	});
});
