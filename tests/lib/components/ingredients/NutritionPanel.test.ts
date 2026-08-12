import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import NutritionPanel from "$lib/components/ingredients/nutrition/NutritionPanel/NutritionPanel.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const peanutButter: FoodItem = {
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
		evidence: {
			factType: "contains",
			sourceType: "label_allergen_field",
			sourceText: "Peanut",
			confidence: "confirmed",
			policyVersion: 2,
			ingredientPath: [],
			percentageLabel: null,
		},
	}],
	foodNutrients: [],
};

describe("NutritionPanel", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps warning evidence and reporting in a closed review section", async () => {
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
		const reviewTitle = screen.getByText("Review these warnings");
		const reviewDetails = reviewTitle.closest("details");
		const disclosureGroup = reviewTitle.closest(".nutrition-panel__disclosures");
		expect(reviewDetails).not.toHaveAttribute("open");
		expect(statusMessage).not.toContainElement(reviewTitle);
		expect(disclosureGroup).toContainElement(reviewTitle);
		expect(statusMessage?.querySelector(".status-icon-badge"))
			.toBeInTheDocument();
		expect(
			statusMessage?.compareDocumentPosition(nutritionFacts) ?? 0,
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

		await fireEvent.click(reviewTitle.closest("summary") as HTMLElement);
		expect(reviewDetails).toHaveAttribute("open");
		expect(reviewDetails).toContainElement(
			screen.getByText(/package’s Contains information lists “Peanut”/i),
		);
		expect(reviewDetails).toContainElement(
			screen.getByText(/current food-check rules: version 2/i),
		);
		expect(screen.getByRole("button", {
			name: "Report an incorrect warning about peanut",
		})).toBeInTheDocument();
	});

	it("lets a signed-in user send a warning for moderation review", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ status: "submitted" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		render(NutritionPanel, {
			props: {
				food: {
					...peanutButter,
					sourceKey: "usda",
					barcode: "00000000119993",
				},
				viewingGrams: 100,
				showListActions: false,
			},
		});

		await fireEvent.click(
			screen.getByText("Review these warnings").closest("summary") as HTMLElement,
		);
		await fireEvent.click(
			screen.getByRole("button", {
				name: "Report an incorrect warning about peanut",
			}),
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/food-compatibility/feedback",
			expect.objectContaining({ method: "POST" }),
		);
		expect(
			await screen.findByText("Thanks—we’ll review this warning."),
		).toBeInTheDocument();
	});

	it("lets users report a missing warning for a reviewed preference", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ status: "submitted" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		render(NutritionPanel, {
			props: {
				food: {
					...peanutButter,
					preferenceWarnings: [],
					sourceKey: "usda",
					barcode: "00000000119993",
					compatibilityEvaluation: {
						version: 1,
						status: "incomplete",
						policyVersion: 3,
						profileApplied: true,
						conflictCount: 0,
						coverage: {
							basis: "packaged-label",
							identity: "not_required",
							ingredients: "available",
							allergens: "missing",
							traces: "missing",
							policy: "available",
						},
						regulatoryContext: {
							status: "not_selected",
							requestedRegionCode: null,
							selectionSource: null,
							profile: null,
							coveredPreferences: [],
							uncoveredPreferences: [],
						},
						preferenceResolution: {
							resolvedCount: 1,
							resolvedPreferences: [{
								tagId: "6cd4fcf5-9221-4b5b-ae90-b0d20f26af1b",
								tagSlug: "milk",
								label: "Milk",
								rawValue: "Dairy",
								type: "allergen",
							}],
							unresolvedPreferences: [],
						},
					},
				},
				viewingGrams: 100,
				showListActions: false,
			},
		});

		await fireEvent.click(
			screen.getByText("Missing a food warning?").closest("summary") as HTMLElement,
		);
		await fireEvent.input(
			screen.getByLabelText("What should we check?"),
			{ target: { value: "The current ingredients list includes milk." } },
		);
		await fireEvent.click(screen.getByRole("button", { name: "Send for review" }));

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/food-compatibility/missing-warning",
			expect.objectContaining({ method: "POST" }),
		);
		const requestBody = fetchMock.mock.calls[0]?.[1]?.body as FormData;
		expect(requestBody.get("preferenceTagId"))
			.toBe("6cd4fcf5-9221-4b5b-ae90-b0d20f26af1b");
		expect(await screen.findByText(
			"Thanks. We’ll compare this with the current package and product record.",
		)).toBeInTheDocument();
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

	it("groups every disclosure at the bottom and keeps moderator actions last", () => {
		const { container } = render(NutritionPanel, {
			props: {
				food: {
					...peanutButter,
					ingredients: "Peanuts, sea salt",
					ingredientPresentation: {
						ingredientText: "Peanuts, sea salt",
						rows: [{
							text: "Peanuts",
							depth: 0,
							path: ["Peanuts"],
							percentageLabel: "About 98%",
							classifications: [],
						}],
						additives: [],
						metrics: [],
						tagGroups: [],
						hasSourceAnalysis: false,
					},
					allergenDisclosure: {
						contains: ["Peanuts"],
						mayContain: [],
					},
					compatibilityEvaluation: {
						version: 1,
						status: "conflict",
						policyVersion: 2,
						profileApplied: true,
						conflictCount: 1,
						coverage: {
							basis: "packaged-label",
							identity: "not_required",
							ingredients: "available",
							allergens: "available",
							traces: "missing",
							policy: "available",
						},
						regulatoryContext: {
							status: "unsupported",
							requestedRegionCode: "ZZ",
							selectionSource: "account",
							profile: null,
							coveredPreferences: [],
							uncoveredPreferences: [],
						},
						preferenceResolution: {
							resolvedCount: 1,
							resolvedPreferences: [],
							unresolvedPreferences: [],
						},
					},
					image: {
						source: "open-food-facts",
						sourceReference: "00000000119993",
						role: "front",
						imageUrl: "https://example.com/peanut-butter.jpg",
						licenseName: "Open Database License",
						confidence: "moderator-reviewed",
					},
				},
				viewingGrams: 100,
				canAdjustImagePlacement: true,
				onImagePlacementSave: vi.fn(),
			},
		});

		const disclosureGroup = container.querySelector(
			".nutrition-panel__disclosures",
		);
		const disclosures = Array.from(container.querySelectorAll("details"));
		const ingredientsHeading = screen.getByRole("heading", { name: "Ingredients" });
		const containsHeading = screen.getByRole("heading", { name: "Contains" });
		const listAction = screen.getByRole("button", { name: "Add to Fridge" });
		const summaries = Array.from(
			disclosureGroup?.querySelectorAll("summary") ?? [],
		);

		expect(disclosureGroup).toBeInTheDocument();
		expect(disclosures.length).toBeGreaterThanOrEqual(5);
		for (const disclosure of disclosures) {
			expect(disclosureGroup).toContainElement(disclosure);
			expect(disclosure).not.toHaveAttribute("open");
		}
		expect(ingredientsHeading.compareDocumentPosition(disclosureGroup as Node))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(containsHeading.compareDocumentPosition(disclosureGroup as Node))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(listAction.compareDocumentPosition(disclosureGroup as Node))
			.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(summaries.at(-1)).toHaveTextContent("Adjust card image placement");
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
					ingredientPresentation: {
						ingredientText: "Peanuts, sea salt",
						rows: [{
							text: "Peanuts",
							depth: 0,
							path: ["Peanuts"],
							percentageLabel: "About 98%",
							classifications: [],
						}],
						additives: ["Sea salt"],
						metrics: [],
						tagGroups: [],
						hasSourceAnalysis: false,
					},
					additives: ["en:sea-salt"],
					foodServings: [
						{
							label: "2 tbsp",
							gramWeight: 32,
							amount: 2,
							unitKey: "tbsp",
							isPrimary: true,
							measureType: "Package serving",
							isHouseholdMeasure: true,
							sourceMeasureKey: "serving_size",
							origin: "package-label",
							gramWeightMethod: "source-reported",
							calculationBasis: "Package reports 2 tbsp as 32g",
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
					sourceAttributions: [
						{
							datasetKey: "example-2026",
							datasetName: "Example Food Dataset",
							datasetVersion: "2026",
							sourceName: "Example Agency",
							sourceUrl: "https://example.com/data",
							licenseName: "Example Open License",
							licenseUrl: "https://example.com/license",
							attributionText: "Example food data attribution.",
						},
						{
							datasetKey: "second-2026",
							datasetName: "Second Food Dataset",
							datasetVersion: "2026",
							sourceName: "Second Agency",
							sourceUrl: "https://example.com/second-data",
							licenseName: "Second Open License",
							licenseUrl: "https://example.com/second-license",
							attributionText: "Second food data attribution.",
						},
					],
				},
				viewingGrams: 100,
				showListActions: false,
			},
		});

		const moreTitle = screen.getByText("More about this food");
		const moreDetails = moreTitle.closest("details");
		expect(moreDetails).not.toHaveAttribute("open");
		await fireEvent.click(moreTitle.closest("summary") as HTMLElement);
		expect(moreDetails).toHaveAttribute("open");

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
			await fireEvent.click(
				screen.getByText("Ingredient details").closest("summary") as HTMLElement,
			);
			expect(screen.getByText("About 98%")).toBeInTheDocument();
		expect(screen.getByText("Sea salt")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Serving details" }))
			.toBeInTheDocument();
		expect(screen.getByText("2 tbsp · 32g")).toBeInTheDocument();
		expect(screen.getByText("Package label")).toBeInTheDocument();
		expect(screen.getByText("Weight reported directly by the source · Package reports 2 tbsp as 32g"))
			.toBeInTheDocument();
		expect(screen.getByText("Package serving · serving_size"))
			.toBeInTheDocument();
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
		expect(screen.getByText("Second food data attribution.")).toBeInTheDocument();
		expect(
			screen.getByRole("link", {
				name: /view source for example food dataset/i,
			}),
		).toHaveAttribute("href", "https://example.com/data");
		expect(
			screen.getByRole("link", {
				name: /view source for second food dataset/i,
			}),
		).toHaveAttribute("href", "https://example.com/second-data");
		expect(screen.getByRole("link", { name: /example open license/i }))
			.toHaveAttribute("href", "https://example.com/license");
		expect(screen.getByRole("link", { name: /second open license/i }))
			.toHaveAttribute("href", "https://example.com/second-license");
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
