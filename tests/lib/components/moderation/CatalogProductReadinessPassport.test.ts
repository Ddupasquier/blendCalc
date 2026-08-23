import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CatalogProductReadinessPassport from "$lib/components/moderation/CatalogProductReadinessPassport/CatalogProductReadinessPassport.svelte";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("CatalogProductReadinessPassport", () => {
	it("separates app availability from API publication and keeps supporting evidence collapsed", async () => {
		render(CatalogProductReadinessPassport, {
			props: { passport: catalogProductReadinessPassportFixture },
		});

		expect(screen.getByText("Roasted Onion & Garlic Pasta Sauce")).toBeInTheDocument();
		expect(screen.getAllByText("Available")).toHaveLength(2);
		expect(screen.getAllByText("Withheld").length).toBeGreaterThan(0);
		expect(screen.getByText("What needs attention").closest("details"))
			.toHaveAttribute("open");
		expect(screen.getByText("Nutrition is missing source evidence"))
			.toBeInTheDocument();
		expect(screen.queryByText("CATALOG_NUTRIENT_PROVENANCE_MISSING"))
			.not.toBeInTheDocument();

		const evidenceSummary = screen.getByText("Evidence coverage").closest("summary");
		expect(evidenceSummary?.closest("details")).not.toHaveAttribute("open");
		await fireEvent.click(evidenceSummary as HTMLElement);
		expect(screen.getByText("13 of 14")).toBeInTheDocument();
		expect(screen.getByText(/open-food-facts, usda-fdc/u)).toBeInTheDocument();
	});
});
