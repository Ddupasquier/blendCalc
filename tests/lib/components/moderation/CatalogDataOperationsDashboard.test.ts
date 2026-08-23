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

		expect(screen.getByText("Products available in blendCalc")).toBeInTheDocument();
		expect(screen.getByText("Products ready for API v1")).toBeInTheDocument();
		expect(screen.queryByText("Official recall matches")).not.toBeInTheDocument();
		expect(screen.queryByText("Provider changes")).not.toBeInTheDocument();
		expect(screen.queryByText("Catalog conflicts")).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Review product submissions" }))
			.not.toBeInTheDocument();

		const sourceSummary = screen.getByText("Source activity").closest("summary");
		expect(sourceSummary?.closest("details")).not.toHaveAttribute("open");
		await fireEvent.click(sourceSummary as HTMLElement);
		expect(screen.getByText("USDA FoodData Central")).toBeInTheDocument();
		expect(screen.getByText(
			"Most-used sources appear first, based on lookups during this 30-day window.",
		)).toBeInTheDocument();
		expect(screen.getByText("Lookups")).toBeInTheDocument();
		expect(screen.queryByText("sourceEvaluation.details")).not.toBeInTheDocument();
	});
});
