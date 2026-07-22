import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nutrition label readability", () => {
	it("uses readable shared badge and narrow-panel typography tokens", () => {
		const textBadgeStyles = readFileSync(
			"src/lib/components/common/badges/TextBadge/TextBadge.scss",
			"utf8",
		);
		const nutritionLabel = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionFactsLabel.svelte",
			"utf8",
		);
		const sourceAttribution = readFileSync(
			"src/lib/components/common/display/SourceAttribution.svelte",
			"utf8",
		);

		expect(textBadgeStyles).toContain("min-height: 1.25rem");
		expect(textBadgeStyles).toContain("font-size: 0.76rem");
		expect(nutritionLabel).toContain(
			"@media (max-width: $app-breakpoint-sm)",
		);
		expect(nutritionLabel).toContain("font-size: $app-font-size-md");
		expect(sourceAttribution).toContain("font-size: $app-font-size-sm");
	});
});
