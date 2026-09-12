import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogConflictDecisionWorkbench from "$lib/components/moderation/CatalogConflictDecisionWorkbench/CatalogConflictDecisionWorkbench.svelte";

const handoff = {
	applicationFoodId: 373595,
	servingWeightGrams: 150,
	pendingSubmissionId: null,
	findings: [
		{
			id: "conflict-id",
			type: "catalog_conflict" as const,
			label: "Open catalog conflict",
			fieldLabel: "Sodium, Na",
			comparisonBasis: "per 100 g",
			affectedFieldPaths: ["nutrient:1093"],
			currentValue: {
				index: null,
				source: "USDA FoodData Central · record 373595",
				sourceKey: "usda",
				sourceReference: "373595",
				value: "59 mg · per 100 g",
				amountPer100g: 59,
				unit: "mg",
				observedAt: "2026-08-01T12:00:00Z",
				sourceType: "government_dataset",
				sourceUrl: "https://fdc.nal.usda.gov/",
				redistributionAllowed: true,
			},
			evidence: [
				{
					index: 0,
					source: "Open Food Facts · record 00000000772914",
					sourceKey: "open-food-facts",
					sourceReference: "00000000772914",
					value: "40 mg · per 100 g",
					amountPer100g: 40,
					unit: "mg",
					observedAt: "2026-08-02T12:00:00Z",
					sourceType: "community_database",
					sourceUrl: "https://world.openfoodfacts.org/",
					redistributionAllowed: true,
				},
			],
			status: "needs_correction" as const,
			submissionId: null,
		},
	],
};

describe("CatalogConflictDecisionWorkbench", () => {
	it("shows the values, evidence context, difference, and per-serving conversion", () => {
		render(CatalogConflictDecisionWorkbench, {
			props: { productId: "product-id", handoff },
		});

		expect(screen.getByText("Decide the 1 actual conflict")).toBeVisible();
		expect(screen.getByText("Stored value")).toBeVisible();
		expect(screen.getByText("59 mg · per 100 g")).toBeVisible();
		expect(screen.getByText("88.5 mg per 150 g serving")).toBeVisible();
		expect(screen.getByText("40 mg · per 100 g")).toBeVisible();
		expect(screen.getByText("60 mg per 150 g serving")).toBeVisible();
		expect(screen.getByText("-19 mg (-32.2%)")).toBeVisible();
		expect(screen.getByText("Aug 2, 2026")).toBeVisible();
		expect(screen.getAllByText("Allowed")).toHaveLength(2);
	});

	it("explains all four terminal outcomes and enables one finish action only after a complete note", async () => {
		const { container } = render(CatalogConflictDecisionWorkbench, {
			props: { productId: "product-id", handoff },
		});
		const outcome = screen.getByRole("combobox", {
			name: "What should happen to Sodium, Na?",
		});
		const finish = screen.getByRole("button", {
			name: "Finish product review",
		});
		expect(finish).toBeDisabled();

		await fireEvent.click(outcome);
		await fireEvent.click(
			screen.getByRole("option", { name: "Keep the stored value" }),
		);
		expect(
			screen.getByText(/stored value stays unchanged, this conflict closes/u),
		).toBeVisible();

		await fireEvent.click(outcome);
		await fireEvent.click(
			screen.getByRole("option", { name: "Use a provider observation" }),
		);
		expect(
			screen.getByText(
				/product stays unchanged until another reviewer approves it/u,
			),
		).toBeVisible();

		await fireEvent.click(outcome);
		await fireEvent.click(
			screen.getByRole("option", { name: "Enter another evidenced value" }),
		);
		expect(screen.getByLabelText(/Replacement value per 100 g/u)).toBeVisible();

		await fireEvent.click(outcome);
		await fireEvent.click(
			screen.getByRole("option", {
				name: "Cannot determine from current evidence",
			}),
		);
		expect(
			screen.getByText(/evidence snapshot leaves the work queue/u),
		).toBeVisible();
		await fireEvent.input(
			screen.getByRole("textbox", {
				name: "What evidence is missing or inconclusive?",
			}),
			{
				target: {
					value:
						"The provider records conflict and no current package label is available.",
				},
			},
		);
		expect(finish).toBeEnabled();
		expect(
			container.querySelector<HTMLInputElement>('input[name="decisions"]')
				?.value,
		).toContain('"outcome":"insufficient_evidence"');
	});
});
