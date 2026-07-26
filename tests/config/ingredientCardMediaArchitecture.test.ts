import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const featureMedia = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardFeatureMedia/IngredientCardFeatureMedia.svelte",
	"utf8",
);
const featureMediaStyles = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardFeatureMedia/IngredientCardFeatureMedia.scss",
	"utf8",
);
const imageViewportStyles = readFileSync(
	"src/lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.scss",
	"utf8",
);
const savedCard = readFileSync(
	"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte",
	"utf8",
);
const searchCard = readFileSync(
	"src/lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte",
	"utf8",
);

describe("ingredient card media architecture", () => {
	it("uses one full-height media component across saved and search cards", () => {
		expect(savedCard).toContain("<IngredientCardFeatureMedia {food} />");
		expect(searchCard).toContain("<IngredientCardFeatureMedia {food} />");
		expect(featureMedia).toContain("<IngredientCardFeatureImage");
		expect(featureMedia).toContain("<FoodSymbol food={fallbackFood} />");
		expect(savedCard).not.toContain("CircularMediaFrame");
		expect(searchCard).not.toContain("CircularMediaFrame");
	});

	it("centers fallback symbols on both axes", () => {
		expect(featureMediaStyles).toContain(
			"$fallback-fade-reserve: calc($app-gap-sm * 2)",
		);
		expect(featureMediaStyles).toContain("display: flex");
		expect(featureMediaStyles).toContain("box-sizing: border-box");
		expect(featureMediaStyles).toContain("width: 100%");
		expect(featureMediaStyles).toContain("height: 100%");
		expect(featureMediaStyles).toContain("align-items: center");
		expect(featureMediaStyles).toContain("justify-content: center");
		expect(featureMediaStyles).toContain(
			"padding-inline-end: $fallback-fade-reserve",
		);
		expect(featureMediaStyles).not.toContain("width: 52%");
		expect(featureMediaStyles).not.toContain("transform:");
	});

	it("preserves source image aspect ratios", () => {
		expect(imageViewportStyles).toMatch(
			/\.image-placement-viewport__image--legacy[\s\S]*object-fit:\s*cover/,
		);
		expect(imageViewportStyles).toMatch(
			/\.image-placement-viewport__image--current[\s\S]*object-fit:\s*contain/,
		);
		expect(imageViewportStyles).not.toContain("object-fit: fill");
	});
});
