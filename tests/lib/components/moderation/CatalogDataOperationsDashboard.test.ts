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
			},
		});

		expect(screen.getByText("Active shared catalog")).toBeInTheDocument();
		expect(screen.getByText("Public blendCalcAPI v1")).toBeInTheDocument();
		expect(screen.getByText("Shared catalog only")).toBeInTheDocument();
		expect(screen.getByText("API publication coverage")).toBeInTheDocument();
		expect(
			screen
				.getByText("Shared catalog only")
				.closest("article")
				?.querySelector(".text-badge__label"),
		).toHaveTextContent("4");
		expect(screen.getByText("75%")).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Diagnostic checks" }),
		).toBeVisible();
		expect(
			screen.queryByRole("heading", { name: "Required work" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("Other tracked operational issues"),
		).not.toBeInTheDocument();
		expect(screen.getByText("Publication readiness")).toBeVisible();
		expect(screen.getByText("Historical revision audit")).toBeVisible();
		expect(
			screen.getByText(
				"Older revisions missing field-by-field audit details. These checks do not change the current product or its blendCalcAPI status.",
			),
		).toBeVisible();
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
