import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView/NutritionDetailView.svelte";
import type { FdcFood } from "$lib/utils/food/types";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceData";

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
	it("shows the complete product name in the nutrition header", () => {
		const longName =
			"Roasted Onion & Garlic Pasta Sauce With Extra Herbs & Vegetables";
		render(NutritionDetailView, {
			props: {
				food: { ...spinach, description: longName },
				onClose: vi.fn(),
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(longName);
	});

	it("shows the canonical food name instead of a personal list name", () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					description: "My Greens",
					canonicalDescription: "Spinach, Raw",
					nameProvenance: "user",
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByRole("heading", { level: 1 }))
			.toHaveTextContent("Spinach, Raw");
		expect(screen.queryByText("My Greens")).not.toBeInTheDocument();
	});

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

	it("steps viewing amount in 1g increments", async () => {
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByText("100g")).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /increase viewing amount by 1g/i }),
		);
		expect(screen.getByText("101g")).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /decrease viewing amount by 1g/i }),
		);
		expect(screen.getByText("100g")).toBeInTheDocument();
	});

	it("uses a stored product serving and keeps 100g available", async () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					hasSourceServing: true,
					foodServings: [{
						label: "2 tbsp",
						gramWeight: 30,
						amount: 2,
						unitKey: "tbsp",
						isPrimary: true,
						source: "usda",
						confidence: "source-verified",
					}],
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByText("30g")).toBeInTheDocument();
		expect(screen.getByText("Serving Size")).toBeInTheDocument();
		expect(screen.getByText("2 tbsp (30g)")).toBeInTheDocument();
		expect(screen.getByText("Amount per serving")).toBeInTheDocument();
		await fireEvent.change(screen.getByRole("combobox", { name: "Serving" }), {
			target: { value: "standard-100g" },
		});
		expect(screen.getByText("100g")).toBeInTheDocument();
		expect(screen.getByText("Per 100g food data")).toBeInTheDocument();
		expect(screen.queryByText("Serving Size")).not.toBeInTheDocument();
	});

	it("uses a compact back button with room for its focus outline", () => {
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByRole("button", { name: "Back to ingredients" })).toHaveAttribute(
			"data-size",
			"small",
		);
	});

	it("hides redundant list status when opened from a saved list", () => {
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
				listMembership: { inFridge: true, inShoppingList: false },
			},
		});

		expect(screen.queryByText("Already in Fridge")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add to Fridge" }))
			.not.toBeInTheDocument();
	});

	it("shows stored source identity and USDA subtype", () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					sourceLabel: "USDA FoodData Central",
					sourceDataType: "SR Legacy",
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByText("Source: USDA FoodData Central")).toBeInTheDocument();
		expect(screen.getByText("SR Legacy")).toBeInTheDocument();
	});

	it("keeps neutral source attribution separate from verification", () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					customFood: true,
					sourceKey: "usda",
					trustStatus: "source-verified",
					sourceLabel: "USDA FoodData Central",
					sourceDataType: "Branded",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.queryByLabelText("Source: USDA")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Verification status: Verified"))
			.toBeInTheDocument();
		expect(screen.queryByLabelText("Source: Custom")).not.toBeInTheDocument();
		expect(screen.getByText("Source: USDA FoodData Central")).toBeInTheDocument();
		expect(screen.getByText("Branded")).toBeInTheDocument();
		expect(
			screen.getByLabelText("Verification status: Verified")
				.closest(".nf-heading-badges"),
		).toBeInTheDocument();
	});
});
