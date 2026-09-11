import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogDataOperationsDashboard from "$lib/components/moderation/CatalogDataOperationsDashboard/CatalogDataOperationsDashboard.svelte";
import { catalogDataOperationsHealthFixture } from "../../../fixtures/catalogDataOperationsHealth";
import { catalogMonitorModerationFixture } from "../../../fixtures/catalogMonitorModeration";

describe("CatalogDataOperationsDashboard", () => {
	it("shows operational summaries without mixing in catalog review queues", async () => {
		render(CatalogDataOperationsDashboard, {
			props: {
				dashboard: catalogDataOperationsHealthFixture,
				catalogMonitor: catalogMonitorModerationFixture,
				actionCount: 2,
				actionSubjectsTruncated: false,
				actionSubjects: [
					{
						subjectType: "shared_product",
						subjectKey: "product-id",
						displayName: "Evidence-light cereal",
						context: "Example Foods",
						issueCount: 2,
						severity: "blocking",
						summary: "A required nutrient is missing.",
						resolutionAction: "submit_catalog_correction",
						destination:
							"/profile/privileged-tools/data-operations/products/product-id",
						missingPrerequisite: null,
						issues: [
							{
								code: "CATALOG_REQUIRED_NUTRIENT_MISSING",
								summary: "A required nutrient is missing.",
								resolutionAction: "submit_catalog_correction",
								severity: "blocking",
								parameters: { nutrientId: 1008 },
							},
							{
								code: "CATALOG_FIELD_PROVENANCE_MISSING",
								summary: "Product information lacks source evidence.",
								resolutionAction: "repair_catalog_field_provenance",
								severity: "blocking",
								parameters: { fieldKey: "ingredients" },
							},
						],
					},
					{
						subjectType: "generic_food_dataset",
						subjectKey: "dataset-key",
						displayName: "Example dataset",
						context: "example-source",
						issueCount: 1,
						severity: "attention",
						summary: "Import evidence is missing.",
						resolutionAction: "review_dataset_import",
						destination:
							"/profile/privileged-tools/data-operations/datasets/dataset-key",
						missingPrerequisite: null,
						issues: [
							{
								code: "DATASET_IMPORT_EVIDENCE_MISSING",
								summary: "Import evidence is missing.",
								resolutionAction: "review_dataset_import",
								severity: "attention",
								parameters: {},
							},
						],
					},
				],
			},
		});

		expect(
			screen.getByText("Products available in blendCalc"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Products ready for blendCalcAPI v1"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Required work" }),
		).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Diagnostic checks" }),
		).toBeVisible();
		expect(screen.getByText("Evidence-light cereal")).toBeVisible();
		expect(screen.getByText("Example dataset")).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Open product readiness" }),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(
			screen.getByRole("link", { name: "Record dataset evidence" }),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/data-operations/datasets/dataset-key",
		);
		expect(
			screen.queryByText("Other tracked operational issues"),
		).not.toBeInTheDocument();
		expect(screen.getByText("Publication readiness")).toBeVisible();
		expect(
			screen.getByText("A required nutrient is missing: Potassium, K"),
		).toBeVisible();
		expect(
			screen.queryByText("A required nutrient is missing: Product information"),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Inspect first product" }),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(screen.getAllByText("1 match").length).toBeGreaterThanOrEqual(3);
		expect(screen.getByText("1 source")).toBeVisible();
		expect(screen.getByText("1 dataset")).toBeVisible();
		expect(
			screen.queryByText("Official recall matches"),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Provider changes")).not.toBeInTheDocument();
		expect(screen.queryByText("Catalog conflicts")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Review product submissions" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Inspect first mapping" }),
		).toHaveAttribute(
			"href",
			"/profile/privileged-tools/data-operations/nutrient-mappings/mapping-id",
		);

		const sourceSummary = screen
			.getByText("Source activity")
			.closest("summary");
		expect(sourceSummary?.closest("details")).not.toHaveAttribute("open");
		await fireEvent.click(sourceSummary as HTMLElement);
		expect(screen.getByText("USDA FoodData Central")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Most-used sources appear first, based on lookups during this 30-day window.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Lookups")).toBeInTheDocument();
		expect(
			screen.queryByText("sourceEvaluation.details"),
		).not.toBeInTheDocument();
	});
});
