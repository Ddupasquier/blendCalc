import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const spinach: FdcFood = {
	fdcId: 168462,
	description: "Spinach, raw",
	foodCategory: "Vegetables and Vegetable Products",
	dataType: "SR Legacy",
	foodNutrients: [
		{
			nutrientId: 1008,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "KCAL",
			value: 23,
		},
	],
};

describe("NutritionDetailView", () => {
	it("shows a source-backed product image when available", () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					image: {
						source: "open-food-facts",
						sourceReference: "00000000000000",
						role: "front",
						imageUrl: "https://example.com/spinach-front.jpg",
						licenseName: "Example license",
						confidence: "imported",
					},
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByRole("img", { name: /spinach, raw package image/i }))
			.toHaveAttribute("src", "https://example.com/spinach-front.jpg");
	});

	it("steps viewing amount in 5g increments", async () => {
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByText("100g")).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /increase viewing amount by 5g/i }),
		);
		expect(screen.getByText("105g")).toBeInTheDocument();
		expect(screen.queryByText("125g")).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /decrease viewing amount by 5g/i }),
		);
		expect(screen.getByText("100g")).toBeInTheDocument();
	});
});
