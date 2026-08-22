import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import DataHealthDashboard from "$lib/components/moderation/DataHealthDashboard/DataHealthDashboard.svelte";
import { moderatorDataHealthFixture } from "../../../fixtures/moderatorDataHealth";
import { catalogMonitorModerationFixture } from "../../../fixtures/catalogMonitorModeration";

describe("DataHealthDashboard", () => {
	it("shows bounded summaries and keeps detailed sections closed initially", async () => {
		render(DataHealthDashboard, {
			props: {
				dashboard: moderatorDataHealthFixture,
				catalogMonitor: catalogMonitorModerationFixture,
				viewerRole: "moderator",
			},
		});

		expect(screen.getByRole("heading", { name: "Catalog data health" }))
			.toBeInTheDocument();
		expect(screen.getByText("16")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Review product submissions" }))
			.toHaveAttribute(
				"href",
				"/profile/moderator-actions/product-submissions",
			);

		const sourceSummary = screen.getByText("Source activity").closest("summary");
		expect(sourceSummary?.closest("details")).not.toHaveAttribute("open");
		await fireEvent.click(sourceSummary as HTMLElement);
		expect(screen.getByText("USDA FoodData Central")).toBeInTheDocument();
		expect(screen.getByText(
			"Most-used sources appear first, based on lookups during this 30-day window.",
		)).toBeInTheDocument();
		expect(screen.getByText("Lookups in window")).toBeInTheDocument();
		expect(screen.queryByText("sourceEvaluation.details")).not.toBeInTheDocument();
	});
});
