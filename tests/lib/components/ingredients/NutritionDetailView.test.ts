import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import NutritionDetailView from "$lib/components/ingredients/nutrition/NutritionDetailView/NutritionDetailView.svelte";
import type { FoodItem } from "$lib/utils/food/types";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceCatalogs";

const spinach: FoodItem = {
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

afterEach(() => {
	vi.useRealTimers();
});

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

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			longName,
		);
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

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"Spinach, Raw",
		);
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

		expect(
			screen.getByRole("img", { name: /spinach, raw package image/i }),
		).toHaveAttribute("src", "https://example.com/spinach-front.jpg");
	});

	it("accelerates a held amount control, rescales nutrition, and stops on release", async () => {
		vi.useFakeTimers();
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		const increase = screen.getByRole("button", {
			name: /increase viewing amount by 1g/i,
		});
		await fireEvent.pointerDown(increase, {
			button: 0,
			pointerId: 1,
			pointerType: "mouse",
		});
		expect(screen.getByText("101g")).toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByText("103g")).toBeInTheDocument();
		expect(screen.getByText("23.7")).toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(3000);
		expect(screen.getByText("219g")).toBeInTheDocument();
		expect(screen.getByText("50.4")).toBeInTheDocument();
		await fireEvent.pointerUp(increase, {
			pointerId: 1,
			pointerType: "mouse",
		});

		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByText("219g")).toBeInTheDocument();
	});

	it("clamps a held decrease at 1g and disables further decreases", async () => {
		vi.useFakeTimers();
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					hasSourceServing: true,
					foodServings: [
						{
							label: "2 tbsp",
							gramWeight: 30,
							amount: 2,
							unitKey: "tbsp",
							isPrimary: true,
							source: "usda",
							confidence: "source-verified",
						},
					],
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		const decrease = screen.getByRole("button", {
			name: /decrease viewing amount by 1g/i,
		});
		await fireEvent.pointerDown(decrease, {
			button: 0,
			pointerId: 2,
			pointerType: "mouse",
		});
		expect(screen.getByText("29g")).toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(4000);
		expect(screen.getByText("1g")).toBeInTheDocument();
		expect(decrease).toBeDisabled();

		await fireEvent.pointerUp(decrease, {
			pointerId: 2,
			pointerType: "mouse",
		});
		await fireEvent.click(decrease);
		expect(screen.getByText("1g")).toBeInTheDocument();
	});

	it("uses a stored product serving and keeps 100g available", async () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					hasSourceServing: true,
					foodServings: [
						{
							label: "2 tbsp",
							gramWeight: 32,
							amount: 2,
							unitKey: "tbsp",
							isPrimary: true,
							origin: "user-entered",
							gramWeightMethod: "user-reported",
							source: "user-label",
							confidence: "user-reported",
						},
					],
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByText("32g")).toBeInTheDocument();
		expect(screen.getByText("Serving Size")).toBeInTheDocument();
		expect(screen.getByText("2 tbsp (32g)")).toBeInTheDocument();
		expect(screen.getByText("Amount per serving")).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("combobox", { name: "Serving" }));
		await fireEvent.click(
			screen.getByRole("option", { name: "100g standard" }),
		);
		expect(screen.getByText("100g")).toBeInTheDocument();
		expect(screen.getByText("Per 100g food data")).toBeInTheDocument();
		expect(screen.queryByText("Serving Size")).not.toBeInTheDocument();
	});

	it("switches an exact 125g package serving back to the same per-100g values", async () => {
		render(NutritionDetailView, {
			props: {
				food: {
					...spinach,
					fdcId: 2032704,
					description: "Roasted Onion & Garlic Pasta Sauce",
					barcode: "00021130493609",
					sourceKey: "usda",
					sourceLabel: "USDA FoodData Central",
					sourceDataType: "Branded",
					foodNutrients: [
						{
							nutrientId: 1008,
							nutrientName: "Energy",
							nutrientNumber: "208",
							unitName: "KCAL",
							value: 60,
						},
						{
							nutrientId: 1079,
							nutrientName: "Fiber, total dietary",
							nutrientNumber: "291",
							unitName: "G",
							value: 1.6,
						},
					],
					hasSourceServing: true,
					foodServings: [
						{
							label: "1/2 cup",
							gramWeight: 125,
							amount: 0.5,
							unitKey: "cup",
							isPrimary: true,
							source: "usda",
							confidence: "source-verified",
						},
					],
					image: {
						source: "open-food-facts",
						sourceReference: "021130493609",
						role: "front",
						imageUrl: "https://example.com/pasta-sauce.jpg",
						licenseName: "CC BY-SA 3.0",
						licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
						attributionText: "Open Food Facts contributors",
						confidence: "imported",
					},
					fieldProvenance: {
						nutrition: {
							source: "usda",
							sourceReference: "2032704",
							confidence: "source-verified",
						},
						categories: {
							source: "usda",
							sourceReference: "2032704",
							confidence: "source-verified",
						},
						serving: {
							source: "usda",
							sourceReference: "2032704",
							confidence: "source-verified",
						},
						image: {
							source: "open-food-facts",
							sourceReference: "021130493609",
							confidence: "imported",
						},
					},
				},
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(screen.getByText("1/2 cup · 125g")).toBeInTheDocument();
		expect(screen.getByText("1/2 cup (125g)")).toBeInTheDocument();
		expect(screen.getByText("Amount per serving")).toBeInTheDocument();
		expect(screen.getByText("75")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(
			screen.getByText("Source: USDA FoodData Central"),
		).toBeInTheDocument();
		expect(screen.getByText("Branded")).toBeInTheDocument();
		expect(
			screen.getByRole("img", {
				name: "Roasted Onion & Garlic Pasta Sauce package image",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByText("Image: Open Food Facts contributors"),
		).toBeInTheDocument();
		const imageLicense = screen.getByRole("link", {
			name: "CC BY-SA 3.0 (opens in a new tab)",
		});
		expect(imageLicense).toHaveAttribute(
			"href",
			"https://creativecommons.org/licenses/by-sa/3.0/",
		);
		expect(imageLicense).toHaveAttribute("target", "_blank");
		expect(imageLicense).toHaveAttribute("rel", "noopener noreferrer");
		expect(screen.getByText("Total Fat").closest("li")).toHaveTextContent(
			"0 g",
		);
		expect(
			screen.queryByText(/partial nutrition data/i),
		).not.toBeInTheDocument();

		await fireEvent.click(screen.getByText("Food passport"));
		const productDetails = screen
			.getByText("Product details")
			.closest("details");
		await fireEvent.click(screen.getByText("Product details"));
		expect(
			within(productDetails as HTMLElement).getByRole("heading", {
				name: "Data sources",
			}),
		).toBeInTheDocument();
		expect(
			within(productDetails as HTMLElement)
				.getByText("Nutrition data")
				.closest("div"),
		).toHaveTextContent("USDA · 2032704");
		expect(
			within(productDetails as HTMLElement)
				.getByText("Categories")
				.closest("div"),
		).toHaveTextContent("USDA · 2032704");
		expect(
			within(productDetails as HTMLElement)
				.getByText("Serving data")
				.closest("div"),
		).toHaveTextContent("USDA · 2032704");
		expect(
			within(productDetails as HTMLElement)
				.getByText("Product image")
				.closest("div"),
		).toHaveTextContent("Open Food Facts · 021130493609");

		await fireEvent.click(screen.getByRole("combobox", { name: "Serving" }));
		await fireEvent.click(
			screen.getByRole("option", { name: "100g standard" }),
		);
		expect(screen.getByText("100g")).toBeInTheDocument();
		expect(screen.getByText("Per 100g food data")).toBeInTheDocument();
		expect(screen.queryByText("Serving Size")).not.toBeInTheDocument();
		expect(screen.getByText("60")).toBeInTheDocument();
		expect(screen.getByText("1.6")).toBeInTheDocument();
	});

	it("uses a compact back button with room for its focus outline", () => {
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(
			screen.getByRole("button", { name: "Back to ingredients" }),
		).toHaveAttribute("data-size", "small");
	});

	it("marks its scroll surface for stable disclosure expansion", () => {
		render(NutritionDetailView, {
			props: {
				food: spinach,
				onClose: vi.fn(),
				showListActions: false,
			},
		});

		expect(document.querySelector(".nutrition-detail-view__body")).toHaveClass(
			"view-body--scroll",
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
		expect(
			screen.queryByRole("button", { name: "Add to Fridge" }),
		).not.toBeInTheDocument();
	});

	it.each(["Foundation", "SR Legacy"])(
		"shows stored source identity and USDA %s subtype",
		(sourceDataType) => {
			render(NutritionDetailView, {
				props: {
					food: {
						...spinach,
						sourceLabel: "USDA FoodData Central",
						sourceDataType,
					},
					onClose: vi.fn(),
					showListActions: false,
				},
			});

			expect(
				screen.getByText("Source: USDA FoodData Central"),
			).toBeInTheDocument();
			expect(screen.getByText(sourceDataType)).toBeInTheDocument();
		},
	);

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
		expect(
			screen.getByLabelText("Verification status: Verified"),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Source: Custom")).not.toBeInTheDocument();
		expect(
			screen.getByText("Source: USDA FoodData Central"),
		).toBeInTheDocument();
		expect(screen.getByText("Branded")).toBeInTheDocument();
		expect(
			screen
				.getByLabelText("Verification status: Verified")
				.closest(".nf-heading-badges"),
		).toBeInTheDocument();
	});
});
