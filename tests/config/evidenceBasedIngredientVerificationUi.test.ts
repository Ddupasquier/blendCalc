import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ingredientBadges = readFileSync(
	"src/lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte",
	"utf8",
);
const sortSheet = readFileSync(
	"src/lib/components/ingredients/sheets/IngredientFilterSheet/IngredientFilterSheet.svelte",
	"utf8",
);
const nutritionLabel = readFileSync(
	"src/lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.svelte",
	"utf8",
);

describe("evidence-based ingredient verification UI", () => {
	it("keeps provider origin out of compact ingredient badges", () => {
		expect(ingredientBadges).toContain("getIngredientTrustBadge");
		expect(ingredientBadges).not.toContain("getIngredientSourceBadge");
	});

	it("does not expose provider or internal review-method filters", () => {
		expect(sortSheet).toContain('title="Sort"');
		expect(sortSheet).not.toContain("filter-source-heading");
		expect(sortSheet).not.toContain("filter-trust-heading");
	});

	it("preserves neutral source attribution in nutrition details", () => {
		expect(nutritionLabel).toContain("<SourceAttribution");
	});
});
