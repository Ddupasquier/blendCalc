import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import NutritionPanel from "$lib/components/ingredients/nutrition/NutritionPanel/NutritionPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const peanutButter: FdcFood = {
	fdcId: 172470,
	description: "Peanut butter, smooth style, with salt",
	foodCategory: "Legumes and Legume Products",
	allergens: ["peanut"],
	preferenceWarnings: [{
		id: "allergen-peanut-peanut-contains",
		level: "warning",
		category: "allergen",
		label: "peanut",
		code: "FOOD_ALLERGEN_CONTAINS",
		params: { factLabel: "peanut" },
	}],
	foodNutrients: [],
};

describe("NutritionPanel", () => {
	it("renders the shared preference conflict before nutrition facts", () => {
		render(NutritionPanel, {
			props: {
				food: peanutButter,
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const heading = screen.getByText("Check this ingredient");
		const statusMessage = heading.closest(".status-message");
		const nutritionFacts = screen.getByText("Nutrition Facts");

		expect(statusMessage).toHaveAttribute("data-tone", "danger");
		expect(statusMessage).toHaveAttribute("data-icon-placement", "top-end");
		expect(statusMessage).toContainElement(
			screen.getByText(
				/the label lists peanut as an allergen\./i,
			),
		);
		expect(statusMessage?.querySelector(".status-icon-badge"))
			.toBeInTheDocument();
		expect(
			statusMessage?.compareDocumentPosition(nutritionFacts) ?? 0,
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("shows stored product ingredients after nutrition facts", () => {
		const ingredients = "Peanuts, sea salt";
		render(NutritionPanel, {
			props: {
				food: { ...peanutButter, ingredients },
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const nutritionFacts = screen.getByText("Nutrition Facts");
		const ingredientsHeading = screen.getByRole("heading", { name: "Ingredients" });
		expect(screen.getByText(ingredients)).toBeInTheDocument();
		expect(
			nutritionFacts.compareDocumentPosition(ingredientsHeading),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("shows source-provided allergen details below ingredients", () => {
		render(NutritionPanel, {
			props: {
				food: {
					...peanutButter,
						ingredients: "Peanuts, sea salt",
						allergens: ["peanuts"],
						traces: ["tree nuts"],
						allergenDisclosure: {
							contains: ["Peanuts"],
							mayContain: ["Tree nuts"],
						},
					},
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const ingredientsHeading = screen.getByRole("heading", { name: "Ingredients" });
		const containsHeading = screen.getByRole("heading", { name: "Contains" });
		const mayContainHeading = screen.getByRole("heading", { name: "May contain" });

		expect(ingredientsHeading.compareDocumentPosition(containsHeading))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(containsHeading.compareDocumentPosition(mayContainHeading))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(screen.getByText("Peanuts")).toBeInTheDocument();
		expect(screen.getByText("Tree nuts")).toBeInTheDocument();
	});

	it("keeps the complete useful product record in a closed details section", async () => {
		render(NutritionPanel, {
			props: {
				food: {
					...peanutButter,
					brandOwner: "Example Foods",
					barcode: "00012345678905",
					barcodeProvenance: {
						captureMethod: "linear-scan",
						format: "EAN_13",
					},
					foodIdentityType: "packaged",
					brandedFoodCategory: "Nut butters",
					categories: ["Spreads"],
					scientificName: "Arachis hypogaea",
					alternateDescription: "Smooth peanut spread",
					preparation: "Ready to eat",
					packageQuantity: {
						label: "18 oz jar",
						amount: 18,
						unit: "oz",
					},
					labels: ["en:organic"],
					dietaryTags: ["en:gluten-free"],
					foodNutrients: [{
						nutrientId: 1090,
						nutrientName: "Magnesium",
						nutrientNumber: "304",
						unitName: "MG",
						value: 168,
						valueOrigin: "reported",
					}],
					ingredients: "Peanuts, sea salt",
					structuredIngredients: [{
						text: "Peanuts",
						percentEstimate: 98,
					}],
					additives: ["en:sea-salt"],
					foodServings: [
						{
							label: "2 tbsp",
							gramWeight: 32,
							isPrimary: true,
							source: "usda",
						},
						{
							label: "1 tbsp",
							gramWeight: 16,
							isPrimary: false,
							source: "usda",
						},
					],
					customDensityGramsPerMilliliter: 1.05,
					customDensityConfidence: "known",
					sourceIdentifiers: {
						usdaFdcId: "123456",
						manufacturerRecordId: "record-42",
					},
					fieldProvenance: {
						nutrition: {
							source: "usda",
							sourceReference: "123456",
						},
						ingredients: {
							source: "open-food-facts",
							sourceReference: "00012345678905",
						},
					},
					sourcePublishedDate: "2026-01-05",
					sourceModifiedDate: "2026-02-06",
					sourceMetadata: {
						revision: 4,
						languages: ["en", "fr"],
					},
					sourceAttribution: {
						datasetKey: "example-2026",
						datasetName: "Example Food Dataset",
						datasetVersion: "2026",
						sourceName: "Example Agency",
						sourceUrl: "https://example.com/data",
						licenseName: "Example Open License",
						licenseUrl: "https://example.com/license",
						attributionText: "Example food data attribution.",
					},
				},
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const productDetailsTitle = screen.getByText("Product details");
		const productDetailsSummary = productDetailsTitle.closest("summary");
		const productDetails = productDetailsSummary?.closest("details");

		expect(productDetails).not.toHaveAttribute("open");
		await fireEvent.click(productDetailsSummary as HTMLElement);
		expect(productDetails).toHaveAttribute("open");
		expect(screen.getByText("Example Foods")).toBeInTheDocument();
		expect(screen.getByText("00012345678905")).toBeInTheDocument();
		expect(screen.getByText("EAN_13")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Legumes and Legume Products, Nut butters, Spreads",
			),
		).toBeInTheDocument();
		expect(screen.getByText("18 oz jar")).toBeInTheDocument();
		expect(screen.getByText("Arachis hypogaea")).toBeInTheDocument();
		expect(screen.getByText("Organic, Gluten free")).toBeInTheDocument();
		expect(screen.getByText("Magnesium")).toBeInTheDocument();
		expect(screen.getByText("168")).toBeInTheDocument();
		expect(screen.getByText("About 98%")).toBeInTheDocument();
		expect(screen.getByText("Sea salt")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Serving details" }))
			.toBeInTheDocument();
		expect(screen.getByText("2 tbsp · 32g")).toBeInTheDocument();
		expect(screen.getByText("1 tbsp · 16g")).toBeInTheDocument();
		expect(screen.getByText("1.05 g/mL · Known")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Data sources" }))
			.toBeInTheDocument();
		expect(screen.getByText("USDA · 123456")).toBeInTheDocument();
		expect(
			screen.getByText("Open Food Facts · 00012345678905"),
		).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Source details" }))
			.toBeInTheDocument();
		expect(screen.getByText("Example Food Dataset")).toBeInTheDocument();
		expect(screen.getByText("Manufacturer Record ID")).toBeInTheDocument();
		expect(screen.getByText("record-42")).toBeInTheDocument();
		expect(screen.getByText("Jan 5, 2026")).toBeInTheDocument();
		expect(screen.getByText("Feb 6, 2026")).toBeInTheDocument();
		expect(screen.getByText("Example food data attribution.")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /view source/i }))
			.toHaveAttribute("href", "https://example.com/data");
		expect(screen.getByRole("link", { name: /example open license/i }))
			.toHaveAttribute("href", "https://example.com/license");
	});

	it("shows zero instead of a partial-data warning for missing ingredient nutrients", () => {
		render(NutritionPanel, {
			props: {
				food: peanutButter,
				viewingGrams: 100,
				showListActions: false,
			},
		});

		expect(screen.queryByText(/nutrition data/i)).not.toBeInTheDocument();
		expect(screen.getAllByText("0").length).toBeGreaterThan(0);
	});
});
