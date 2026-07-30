import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductDataQualityPanel from "$lib/components/ingredients/nutrition/ProductDataQualityPanel/ProductDataQualityPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const makeFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
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
});
