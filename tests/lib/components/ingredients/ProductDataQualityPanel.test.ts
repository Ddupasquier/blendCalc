import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductDataQualityPanel from "$lib/components/ingredients/nutrition/ProductDataQualityPanel/ProductDataQualityPanel.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const makeFood = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	fdcId: 1,
	description: "Example food",
	foodNutrients: [],
	...overrides,
});

describe("ProductDataQualityPanel", () => {
	it("does not render an empty disclosure", () => {
		render(ProductDataQualityPanel, {
			props: { food: makeFood() },
		});

		expect(screen.queryByText("Data quality")).not.toBeInTheDocument();
	});

	it("starts closed and presents friendly bounded source notes", async () => {
		render(ProductDataQualityPanel, {
			props: {
				food: makeFood({
					sourceMetadata: {
						schemaVersion: 4,
						completeness: 0.73,
						qualityWarningTags: [
							"ingredients-unknown-score-above-0",
						],
					},
					fieldProvenance: {
						nutrition: { source: "usda", sourceReference: "123" },
						image: {
							source: "open-food-facts",
							sourceReference: "00012345678905",
						},
					},
				}),
			},
		});

		const title = screen.getByText("Data quality");
		const summary = title.closest("summary");
		const details = summary?.closest("details");

		expect(details).not.toHaveAttribute("open");
		await fireEvent.click(summary as HTMLElement);
		expect(details).toHaveAttribute("open");
		expect(
			screen.getByText("The source flagged this record for review"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Some source details may be missing"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Accepted fields come from more than one source"),
		).toBeInTheDocument();
		expect(screen.getByText(/source record format: version 4/i))
			.toBeInTheDocument();
		expect(screen.getByText(/license details are listed in product details/i))
			.toBeInTheDocument();
		expect(
			screen.queryByText("ingredients-unknown-score-above-0"),
		).not.toBeInTheDocument();
	});

	it("explains nutrient uncertainty without exposing internal mapping details", async () => {
		render(ProductDataQualityPanel, {
			props: {
				food: makeFood({
					foodNutrients: [{
						nutrientId: 1003,
						nutrientName: "Protein",
						nutrientNumber: "203",
						unitName: "G",
						value: 4,
						valueOrigin: "derived",
						valueStatus: "derived",
						standardError: 0.2,
						mappingReviewReference: "internal-review-42",
					}],
					nutrientSourceReview: [{
						nutrientName: "Source trace nutrient",
						valueStatus: "trace",
						mappingStatus: "canonical",
						mappingReviewReference: "internal-review-43",
					}],
				}),
			},
		});

		const summary = screen.getByText("Data quality").closest("summary");
		await fireEvent.click(summary as HTMLElement);

		expect(screen.getByText("Some nutrient values were calculated"))
			.toBeInTheDocument();
		expect(screen.getByText("The source included measurement uncertainty"))
			.toBeInTheDocument();
		expect(screen.getByText("The source reported nutrients without exact amounts"))
			.toBeInTheDocument();
		expect(screen.queryByText(/internal-review-/)).not.toBeInTheDocument();
	});
});
