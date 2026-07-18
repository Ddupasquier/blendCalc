import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import IngredientProvenanceBadges from "$lib/components/ingredients/provenance/IngredientProvenanceBadges.svelte";
import { ingredientProvenanceOptionsFixture } from "../../../fixtures/referenceData";

describe("IngredientProvenanceBadges", () => {
	it("shows database-backed provenance and compact warning detail", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 1,
					description: "Test food",
					dataType: "Foundation",
					foodNutrients: [],
					sourceKey: "usda",
					trustStatus: "source-verified",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
				warning: "Gluten-free may conflict",
			},
		});

		expect(screen.getByLabelText("Source: USDA")).toHaveClass("text-badge");
		const verified = screen.getByRole("img", {
			name: "Review status: Verified",
		});
		expect(verified).toHaveClass("verified-status-badge");
		expect(verified).toHaveClass("status-icon-badge");
		expect(verified.querySelector("svg")).toBeInTheDocument();
		expect(verified).not.toHaveTextContent("Verified");

		const warning = screen.getByRole("img", {
			name: "Gluten-free may conflict. Open ingredient for details.",
		});
		expect(warning).toHaveAttribute("title", "Gluten-free may conflict");
		expect(warning).toHaveClass("status-icon-badge");
		expect(warning).not.toHaveTextContent("Gluten-free may conflict");
	});

	it("keeps non-verified review states in the shared text badge", () => {
		render(IngredientProvenanceBadges, {
			props: {
				food: {
					fdcId: 2,
					description: "Private food",
					foodNutrients: [],
					sourceKey: "custom",
					trustStatus: "user-private",
				},
				provenanceOptions: ingredientProvenanceOptionsFixture,
			},
		});

		const privateBadge = screen.getByLabelText("Review status: Private");
		expect(privateBadge).toHaveClass("text-badge");
		expect(privateBadge).toHaveTextContent("Private");
		expect(screen.queryByLabelText("Review status: Verified"))
			.not.toBeInTheDocument();
	});
});
