import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nutrition serving selector spacing", () => {
	it("uses shared layout and control spacing tokens", () => {
		const componentStyles = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionServingSelect/NutritionServingSelect.scss",
			"utf8",
		);
		const selectFieldStyles = readFileSync(
			"src/lib/components/common/forms/SelectField/SelectField.scss",
			"utf8",
		);
		const servingComponent = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionServingSelect/NutritionServingSelect.svelte",
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

		expect(componentStyles).toContain("padding: $app-gap-md 0");
		expect(componentStyles).not.toContain("padding-block: $app-gap-sm");
		expect(servingComponent).toContain("<SelectField");
		expect(selectFieldStyles).toContain("$app-shell-control-padding-x");
		expect(selectFieldStyles).toContain("$app-focus-outline");
		expect(detailViewComponent).toContain(
			'<div class="nutrition-detail-view__measurement-controls">',
		);
		expect(detailViewStyles).toMatch(
			/\.nutrition-detail-view__measurement-controls\s*\{[^}]*gap:\s*0;/s,
		);
	});
});
