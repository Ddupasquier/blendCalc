import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nutrition serving selector spacing", () => {
	it("uses shared layout and control spacing tokens", () => {
		const component = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionServingSelect.svelte",
			"utf8",
		);
		const detailView = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionDetailView.svelte",
			"utf8",
		);

		expect(component).toContain("gap: $app-vertical-stack-gap");
		expect(component).toContain("padding: $app-vertical-stack-gap 0");
		expect(component).toContain("padding: 0 $ingredient-control-padding-x");
		expect(component).not.toContain("padding-block: $app-gap-sm");
		expect(detailView).toContain(
			'<div class="nutrition-detail-view__measurement-controls">',
		);
		expect(detailView).toMatch(
			/\.nutrition-detail-view__measurement-controls\s*\{[^}]*gap:\s*0;/s,
		);
	});
});
