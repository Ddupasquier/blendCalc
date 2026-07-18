import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nutrition label readability", () => {
	it("uses readable shared badge and narrow-panel typography tokens", () => {
		const variables = readFileSync("src/styles/_variables.scss", "utf8");
		const nutritionLabel = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionFactsLabel.svelte",
			"utf8",
		);
		const sourceAttribution = readFileSync(
			"src/lib/components/common/display/SourceAttribution.svelte",
			"utf8",
		);

		expect(variables).toContain("$app-text-badge-min-height: 1.25rem");
		expect(variables).toContain(
			"$app-text-badge-font-size: $app-font-size-xs",
		);
		expect(variables).toContain(
			"$nutrition-label-row-font-size-mobile: $app-font-size-md",
		);
		expect(nutritionLabel).toContain(
			"@media (max-width: $app-breakpoint-sm)",
		);
		expect(sourceAttribution).toContain("font-size: $app-font-size-sm");
	});
});
