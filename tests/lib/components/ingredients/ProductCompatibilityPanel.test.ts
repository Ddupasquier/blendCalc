import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductCompatibilityPanel from "$lib/components/ingredients/nutrition/ProductCompatibilityPanel/ProductCompatibilityPanel.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

const notSelectedRegulatoryContext = {
	status: "not_selected" as const,
	requestedRegionCode: null,
	selectionSource: null,
	profile: null,
	coveredPreferences: [],
	uncoveredPreferences: [],
};

const resolvedPreferenceContext = {
	resolvedCount: 0,
	resolvedPreferences: [],
	unresolvedPreferences: [],
};

describe("ProductCompatibilityPanel", () => {
	it("renders explicit and possible allergen disclosures separately", () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					allergenDisclosure: {
						contains: ["Milk", "Soybeans"],
						mayContain: ["Tree nuts"],
					},
				}),
			},
		});

		expect(screen.getByRole("heading", { name: "Contains" }))
			.toBeInTheDocument();
		expect(screen.getByText("Milk, Soybeans")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "May contain" }))
			.toBeInTheDocument();
		expect(screen.getByText("Tree nuts")).toBeInTheDocument();
	});

	it("renders nothing when no source or DB allergen information exists", () => {
		render(ProductCompatibilityPanel, {
			props: { food: createFood() },
		});

		expect(screen.queryByRole("heading", { name: "Contains" }))
			.not.toBeInTheDocument();
		expect(screen.queryByRole("heading", { name: "May contain" }))
			.not.toBeInTheDocument();
	});

	it("shows reviewed dietary labels and considerations without policy jargon", () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					compatibilitySummary: {
						version: 1,
						policyVersion: 1,
						generatedAt: "2026-07-29T00:00:00.000Z",
						allFacts: [
							{
								slug: "vegan",
								label: "Vegan",
								category: "dietary",
								factType: "dietary_claim",
								sourceType: "label_dietary_field",
								sourceText: "en:vegan",
								confidence: "confirmed",
							},
							{
								slug: "meat",
								label: "Meat",
								category: "avoidance",
								factType: "dietary_conflict",
								sourceType: "label_ingredient_field",
								sourceText: "beef",
								confidence: "confirmed",
							},
						],
						contains: [],
						mayContain: [],
						dietaryClaims: [{
							slug: "vegan",
							label: "Vegan",
							category: "dietary",
							factType: "dietary_claim",
							sourceType: "label_dietary_field",
							sourceText: "en:vegan",
							confidence: "confirmed",
						}],
						ingredientSignals: [],
					},
				}),
			},
		});

		expect(screen.getByRole("heading", { name: "Dietary labels" }))
			.toBeInTheDocument();
		expect(screen.getByText("Vegan")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Dietary considerations" }))
			.toBeInTheDocument();
		expect(screen.getByText("Meat")).toBeInTheDocument();
	});

	it("explains a checked result without presenting a safety guarantee", () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					compatibilityEvaluation: {
						version: 1,
						status: "checked",
						policyVersion: 3,
						profileApplied: true,
						conflictCount: 0,
						coverage: {
							basis: "packaged-label",
							identity: "not_required",
							ingredients: "available",
							allergens: "available",
							traces: "available",
							policy: "available",
						},
						regulatoryContext: notSelectedRegulatoryContext,
						preferenceResolution: resolvedPreferenceContext,
					},
				}),
			},
		});

		expect(
			screen.getByText("No conflict found in available information"),
		).toBeInTheDocument();
		expect(screen.getByText(/ingredients and labels can change/i))
			.toBeInTheDocument();
		expect(screen.getByText(/current package label/i)).toBeInTheDocument();
	});

	it("explains incomplete and unchecked evaluations distinctly", () => {
		const incomplete = createFood({
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
				regulatoryContext: notSelectedRegulatoryContext,
				preferenceResolution: resolvedPreferenceContext,
			},
		});
		const { unmount } = render(ProductCompatibilityPanel, {
			props: { food: incomplete },
		});

		expect(screen.getByText("Some food details could not be checked"))
			.toBeInTheDocument();
		expect(screen.getByText(/required ingredient or allergen details are missing/i))
			.toBeInTheDocument();
		unmount();

		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					compatibilityEvaluation: {
						...incomplete.compatibilityEvaluation!,
						status: "not_checked",
						policyVersion: null,
						profileApplied: false,
						coverage: {
							...incomplete.compatibilityEvaluation!.coverage,
							policy: "missing",
						},
					},
				}),
			},
		});
		expect(screen.getByText("Not checked against food settings"))
			.toBeInTheDocument();
	});

	it("keeps regional label context in a closed supporting section", async () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					compatibilityEvaluation: {
						version: 1,
						status: "checked",
						policyVersion: 9,
						profileApplied: true,
						conflictCount: 0,
						coverage: {
							basis: "packaged-label",
							identity: "not_required",
							ingredients: "available",
							allergens: "available",
							traces: "available",
							policy: "available",
						},
						regulatoryContext: {
							status: "applied",
							requestedRegionCode: "US",
							selectionSource: "account",
							profile: {
								key: "us-fda",
								regionCode: "US",
								displayName: "United States major food allergens",
								authority: "U.S. Food and Drug Administration",
								policyReference: "Major food allergens",
								sourceUrl: "https://example.com/us",
								reviewedAt: "2026-07-31T00:00:00.000Z",
							},
							coveredPreferences: [{
								preference: "Peanut",
								regulatedLabel: "Peanuts",
								classification: "major_allergen",
							}],
							uncoveredPreferences: ["Banana"],
						},
						preferenceResolution: resolvedPreferenceContext,
					},
				}),
			},
		});

		const detailsTitle = screen.getByText("Food check details");
		const details = detailsTitle.closest("details");
		expect(details).not.toHaveAttribute("open");
		await fireEvent.click(detailsTitle.closest("summary") as HTMLElement);
		expect(details).toHaveAttribute("open");
		expect(screen.getByRole("heading", { name: "Regional label context" }))
			.toBeInTheDocument();
		expect(screen.getByText(/all of your personal warnings stay active/i))
			.toBeInTheDocument();
		expect(screen.getByText(/Peanut \(Peanuts\)/)).toBeInTheDocument();
		expect(screen.getByText(/Not defined by this regional profile: Banana/))
			.toBeInTheDocument();
	});

	it("keeps unresolved-setting guidance in supporting details", async () => {
		render(ProductCompatibilityPanel, {
			props: {
				food: createFood({
					compatibilityEvaluation: {
						version: 1,
						status: "incomplete",
						policyVersion: 10,
						profileApplied: true,
						conflictCount: 0,
						coverage: {
							basis: "packaged-label",
							identity: "not_required",
							ingredients: "available",
							allergens: "available",
							traces: "available",
							policy: "missing",
						},
						regulatoryContext: notSelectedRegulatoryContext,
						preferenceResolution: {
							resolvedCount: 0,
							resolvedPreferences: [],
							unresolvedPreferences: [{
								label: "Banana sensitivity",
								type: "allergen",
							}],
						},
					},
				}),
			},
		});

		const detailsTitle = screen.getByText("Food check details");
		const details = detailsTitle.closest("details");
		expect(details).not.toHaveAttribute("open");
		await fireEvent.click(detailsTitle.closest("summary") as HTMLElement);
		expect(details).toHaveAttribute("open");
		expect(screen.getByText("Some settings are waiting for review"))
			.toBeInTheDocument();
		expect(screen.getByText(/Banana sensitivity is saved/i))
			.toBeInTheDocument();
	});
});
