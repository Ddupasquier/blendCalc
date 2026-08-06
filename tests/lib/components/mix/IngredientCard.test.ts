import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import IngredientCard from "$lib/components/mix/ingredients/IngredientCard/IngredientCard.svelte";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";

const cardStyles = readFileSync(
	"src/lib/components/mix/ingredients/IngredientCard/IngredientCard.scss",
	"utf8",
);

afterEach(() => configureServingMeasureCatalog(null));

describe("Mix ingredient card", () => {
	it("uses compact unit labels and keeps secondary actions out of the amount row", async () => {
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

		const onServingChange = vi.fn();
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
				onServingChange,
			},
		});

		await fireEvent.click(
			screen.getByRole("combobox", { name: "Measure for Tomato, Roma" }),
		);
		expect(screen.getByRole("option", { name: "g" })).toBeInTheDocument();
		expect(screen.queryByRole("option", { name: "grams" })).not.toBeInTheDocument();
		expect(
			container.querySelector(".ingredient-card__actions"),
		).toContainElement(screen.getByRole("button", { name: "Remove Tomato, Roma" }));
		expect(cardStyles).toContain('". amount amount"');

		await fireEvent.click(
			screen.getByRole("button", { name: "Use more Tomato, Roma" }),
		);
		expect(onServingChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ fdcId: 1 }),
			"86",
			"g",
		);
	});

	it("does not repeat a gram amount that is already editable in the amount row", () => {
		render(IngredientCard, {
			props: {
				food: {
					fdcId: 3,
					description: "Kale, Raw",
					foodNutrients: [],
				},
				sourceLabel: "Fridge",
				quantity: 21,
				unit: "g",
				gramsLabel: null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(screen.getByRole("spinbutton", { name: "Quantity for Kale, Raw" })).toHaveValue(21);
		expect(screen.queryByText(/g equivalent/i)).not.toBeInTheDocument();
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

	it("marks preference conflicts without crowding the resting card", async () => {
		const { container } = render(IngredientCard, {
			props: {
				food: {
					fdcId: 4,
					description: "Pork Chorizo",
					foodNutrients: [],
					preferenceWarnings: [{
						id: "pork-warning",
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
				sourceLabel: "Fridge",
				quantity: 100,
				unit: "g",
				gramsLabel: null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(container.querySelector(".card-warning-edge")).toBeInTheDocument();
		const detailsButton = screen.getByRole("button", {
			name: "Show warning and details for Pork Chorizo",
		});
		expect(detailsButton).toHaveAttribute("aria-expanded", "false");

		await fireEvent.click(detailsButton);
		expect(screen.getByText("Check this ingredient")).toBeInTheDocument();
		expect(detailsButton).toHaveAttribute("aria-expanded", "true");
		expect(detailsButton).toHaveAttribute("aria-controls", "ingredient-4-details");
	});
});
