import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import IngredientCardBadges from "$lib/components/ingredients/list/IngredientCardBadges.svelte";

describe("IngredientCardBadges", () => {
	it("shows a compact warning symbol while preserving its accessible detail", () => {
		render(IngredientCardBadges, {
			props: {
				sourceLabel: "FDC",
				warning: "Gluten-free may conflict",
			},
		});

		const warning = screen.getByRole("img", {
			name: "Gluten-free may conflict. Open ingredient for details.",
		});
		expect(warning).toHaveAttribute("title", "Gluten-free may conflict");
		expect(warning).toHaveClass("status-icon-badge");
		expect(warning).not.toHaveTextContent("Gluten-free may conflict");
	});
});
