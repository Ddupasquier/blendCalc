import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nutrition serving selector spacing", () => {
	it("uses shared layout and control spacing tokens", () => {
		const componentStyles = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionServingSelect/NutritionServingSelect.scss",
			"utf8",
		);
		const detailViewComponent = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionDetailView/NutritionDetailView.svelte",
			"utf8",
		);
		const detailViewStyles = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionDetailView/NutritionDetailView.scss",
			"utf8",
		);

		expect(componentStyles).toContain("gap: $app-gap-md");
		expect(componentStyles).toContain("padding: $app-gap-md 0");
		expect(componentStyles).toContain("padding: 0 $app-shell-control-padding-x");
		expect(componentStyles).not.toContain("padding-block: $app-gap-sm");
		expect(detailViewComponent).toContain(
			'<div class="nutrition-detail-view__measurement-controls">',
		);
		expect(detailViewStyles).toMatch(
			/\.nutrition-detail-view__measurement-controls\s*\{[^}]*gap:\s*0;/s,
		);
	});
});
