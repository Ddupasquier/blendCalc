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
		expect(screen.getByLabelText("Review status: Verified")).toHaveClass(
			"text-badge",
		);

		const warning = screen.getByRole("img", {
			name: "Gluten-free may conflict. Open ingredient for details.",
		});
		expect(warning).toHaveAttribute("title", "Gluten-free may conflict");
		expect(warning).toHaveClass("status-icon-badge");
		expect(warning).not.toHaveTextContent("Gluten-free may conflict");
	});
});
