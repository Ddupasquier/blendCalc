import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nutrition label readability", () => {
	it("uses readable shared badge and narrow-panel typography tokens", () => {
		const textBadgeStyles = readFileSync(
			"src/lib/components/common/badges/TextBadge/TextBadge.scss",
			"utf8",
		);
		const nutritionLabelStyles = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.scss",
			"utf8",
		);
		const sourceAttributionStyles = readFileSync(
			"src/lib/components/common/display/SourceAttribution/SourceAttribution.scss",
			"utf8",
		);

		expect(textBadgeStyles).toContain("min-height: 1.25rem");
		expect(textBadgeStyles).toContain("font-size: $app-font-size-xs");
		expect(nutritionLabelStyles).toContain(
			"@media (max-width: $app-breakpoint-sm)",
		);
		expect(nutritionLabelStyles).toContain("font-size: $app-font-size-md");
		expect(sourceAttributionStyles).toContain("font-size: $app-font-size-sm");
	});
});
