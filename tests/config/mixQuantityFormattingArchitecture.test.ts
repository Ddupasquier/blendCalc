import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const quantitySurfaces = [
	"src/lib/components/mix/controls/GoalTargets/GoalTargets.svelte",
	"src/lib/components/mix/insights/IngredientContributionBreakdown/IngredientContributionBreakdown.svelte",
	"src/lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte",
	"src/lib/components/mix/insights/NutrientShapePanel/NutrientShapePanel.svelte",
	"src/lib/components/mix/save/SaveGoalReview/SaveGoalReview.svelte",
	"src/lib/utils/mix/calculations/mixAnalysis.ts",
	"src/lib/utils/mix/calculations/nutrientSuggestions.ts",
	"src/lib/utils/mix/ui/mixUi.ts",
	"src/lib/utils/mix/warnings/mixWarnings.ts",
];

describe("Mix quantity formatting architecture", () => {
	it("routes every user-facing Mix quantity through one unit-aware formatter", () => {
		for (const path of quantitySurfaces) {
			const source = readFileSync(path, "utf8");
			expect(source, path).toContain("formatMixQuantity");
			expect(source, path).not.toContain("formatChartNumber");
			expect(source, path).not.toContain("formatSignedChartNumber");
			expect(source, path).not.toMatch(/\.toFixed\(|Math\.round\(/);
		}
	});
});
