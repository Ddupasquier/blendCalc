import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import MixIngredientAmountCard from "$lib/components/mix/ingredients/MixIngredientAmountCard/MixIngredientAmountCard.svelte";
import { configureServingMeasureCatalog } from "$lib/utils/serving/servingMeasureCatalog";

const cardStyles = readFileSync(
	"src/lib/components/mix/ingredients/MixIngredientAmountCard/MixIngredientAmountCard.scss",
	"utf8",
);

afterEach(() => configureServingMeasureCatalog(null));

describe("MixIngredientAmountCard", () => {
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
		const { container } = render(MixIngredientAmountCard, {
			props: {
				food: {
					fdcId: 1,
					description: "Tomato, Roma",
					foodNutrients: [],
				},
				sourceListLabel: "Fridge",
				servingQuantity: 85,
				servingUnit: "g",
				convertedWeightLabel: "85g",
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
		expect(
			screen.queryByRole("option", { name: "grams" }),
		).not.toBeInTheDocument();
		expect(
			container.querySelector(".mix-ingredient-amount-card__actions"),
		).toContainElement(
			screen.getByRole("button", { name: "Remove Tomato, Roma" }),
		);
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
		render(MixIngredientAmountCard, {
			props: {
				food: {
					fdcId: 3,
					description: "Kale, Raw",
					foodNutrients: [],
				},
				sourceListLabel: "Fridge",
				servingQuantity: 21,
				servingUnit: "g",
				convertedWeightLabel: null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(
			screen.getByRole("spinbutton", { name: "Quantity for Kale, Raw" }),
		).toHaveValue(21);
		expect(screen.queryByText(/g equivalent/i)).not.toBeInTheDocument();
	});

	it("offers exact household servings and preserves grams when switching units", async () => {
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
		render(MixIngredientAmountCard, {
			props: {
				food: {
					fdcId: 5,
					description: "Banana, Raw",
					foodNutrients: [],
					foodServings: [
						{
							label: "1 medium banana (118 g)",
							gramWeight: 118,
							isPrimary: true,
							gramWeightMethod: "source-reported",
						},
					],
				},
				sourceListLabel: "Fridge",
				servingQuantity: 118,
				servingUnit: "g",
				convertedWeightLabel: null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange,
			},
		});

		await fireEvent.click(
			screen.getByRole("combobox", { name: "Measure for Banana, Raw" }),
		);
		await fireEvent.click(
			screen.getByRole("option", { name: "medium banana" }),
		);

		expect(onServingChange).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: 5 }),
			"1",
			expect.stringMatching(/^source-serving:/),
		);
		expect(
			screen.queryByRole("option", { name: "cup" }),
		).not.toBeInTheDocument();
	});

	it("does not label private foods with a compact custom badge", () => {
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

		render(MixIngredientAmountCard, {
			props: {
				food: {
					fdcId: 2,
					description: "Private recipe",
					foodNutrients: [],
					customFood: true,
				},
				sourceListLabel: "Fridge",
				servingQuantity: 25,
				servingUnit: "g",
				convertedWeightLabel: "25g",
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(screen.queryByText("Custom")).not.toBeInTheDocument();
	});

	it("marks preference conflicts without crowding the resting card", async () => {
		const { container } = render(MixIngredientAmountCard, {
			props: {
				food: {
					fdcId: 4,
					description: "Pork Chorizo",
					foodNutrients: [],
					preferenceWarnings: [
						{
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
						},
					],
				},
				sourceListLabel: "Fridge",
				servingQuantity: 100,
				servingUnit: "g",
				convertedWeightLabel: null,
				onOpenConversionDetails: vi.fn(),
				onCloseConversionDetails: vi.fn(),
				onRemove: vi.fn(),
				onServingChange: vi.fn(),
			},
		});

		expect(container.querySelector(".card-warning-frame")).toBeInTheDocument();
		const detailsButton = screen.getByRole("button", {
			name: "Show warning and details for Pork Chorizo",
		});
		expect(detailsButton).toHaveAttribute("aria-expanded", "false");

		await fireEvent.click(detailsButton);
		expect(screen.getByText("Check this ingredient")).toBeInTheDocument();
		expect(detailsButton).toHaveAttribute("aria-expanded", "true");
		expect(detailsButton).toHaveAttribute(
			"aria-controls",
			"mix-ingredient-4-details",
		);
	});
});
