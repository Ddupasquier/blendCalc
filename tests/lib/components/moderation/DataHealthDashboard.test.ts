import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import DataHealthDashboard from "$lib/components/moderation/DataHealthDashboard/DataHealthDashboard.svelte";
import { moderatorDataHealthFixture } from "../../../fixtures/moderatorDataHealth";

describe("DataHealthDashboard", () => {
	it("shows bounded summaries and keeps detailed sections closed initially", async () => {
		render(DataHealthDashboard, {
			props: {
				dashboard: moderatorDataHealthFixture,
				viewerRole: "moderator",
			},
		});

		expect(screen.getByRole("heading", { name: "Catalog data health" }))
			.toBeInTheDocument();
		expect(screen.getByText("16")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Review product submissions" }))
			.toHaveAttribute("href", "/moderation#product-review");

		const sourceSummary = screen.getByText("Source activity").closest("summary");
		expect(sourceSummary?.closest("details")).not.toHaveAttribute("open");
		await fireEvent.click(sourceSummary as HTMLElement);
		expect(screen.getByText("USDA FoodData Central")).toBeInTheDocument();
		expect(screen.queryByText("sourceEvaluation.details")).not.toBeInTheDocument();
	});
});
