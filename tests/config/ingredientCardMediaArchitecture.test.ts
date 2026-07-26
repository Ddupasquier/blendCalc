import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cardMedia = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte",
	"utf8",
);
const cardMediaStyles = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.scss",
	"utf8",
);
const imageViewportStyles = readFileSync(
	"src/lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.scss",
	"utf8",
);
const mediaLaneStyles = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardMediaLane.scss",
	"utf8",
);
const mediaLane = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardMediaLane.svelte",
	"utf8",
);
const imageViewport = readFileSync(
	"src/lib/components/common/images/ImagePlacementViewport/ImagePlacementViewport.svelte",
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
const savedCardStyles = readFileSync(
	"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.scss",
	"utf8",
);
const searchCardStyles = readFileSync(
	"src/lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.scss",
	"utf8",
);
const placementPreviewStyles = readFileSync(
	"src/lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.scss",
	"utf8",
);
const cardGeometryStyles = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardGeometry.scss",
	"utf8",
);
const imagePlacementEditor = readFileSync(
	"src/lib/components/common/images/ImagePlacementEditor/ImagePlacementEditor.svelte",
	"utf8",
);
const productImageEvidenceInput = readFileSync(
	"src/lib/components/ingredients/manual-entry/ProductImageEvidenceInput/ProductImageEvidenceInput.svelte",
	"utf8",
);
const productImagePanel = readFileSync(
	"src/lib/components/ingredients/nutrition/ProductImagePanel/ProductImagePanel.svelte",
	"utf8",
);
const moderationPage = readFileSync(
	"src/routes/moderation/+page.svelte",
	"utf8",
);

describe("ingredient card media architecture", () => {
	it("uses one full-height media component across saved and search cards", () => {
		expect(savedCard).toContain("<IngredientCardMedia {food} />");
		expect(searchCard).toContain("<IngredientCardMedia {food} />");
		expect(cardMedia).toContain("<IngredientCardMediaLane");
		expect(cardMedia).toContain("<FoodSymbol food={fallbackFood} />");
		expect(savedCard).not.toContain("CircularMediaFrame");
		expect(searchCard).not.toContain("CircularMediaFrame");
	});

	it("keeps saved, search, and placement-preview geometry identical", () => {
		expect(cardGeometryStyles).toContain("$media-lane-width: 28cqw");
		expect(cardGeometryStyles).toContain("$media-content-inset: 18cqw");
		expect(cardGeometryStyles).toContain("container-type: inline-size");
		expect(savedCardStyles).toContain(
			"@include ingredient-card-geometry.frame",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-geometry.frame",
		);
		expect(placementPreviewStyles).toContain(
			"@include ingredient-card-geometry.frame",
		);
		expect(savedCardStyles).toContain(
			"@include ingredient-card-geometry.media-content-inset",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-geometry.media-content-inset",
		);
		expect(placementPreviewStyles).toContain(
			"@include ingredient-card-geometry.media-content-inset",
		);
		expect(placementPreviewStyles).not.toContain("max-width");
	});

	it("uses the exact card preview in user and privileged placement flows", () => {
		expect(imagePlacementEditor).toContain("<ImagePlacementCardPreview");
		expect(imagePlacementEditor).toContain("{showWarningEdge}");
		expect(productImageEvidenceInput).toContain("<ImagePlacementEditor");
		expect(productImagePanel).toContain("<ImagePlacementEditor");
		expect(productImagePanel).toContain("{showWarningEdge}");
		expect(moderationPage).toContain("<ImagePlacementEditor");
	});

	it("anchors contained card images to the outer edge until they overflow", () => {
		expect(mediaLane).toContain('containedInlineAlignment="start"');
		expect(imageViewport).toContain(
			'containedInlineAlignment === "start"',
		);
		expect(imageViewport).toContain("!geometry.canMoveX");
		expect(imageViewportStyles).toContain(
			".image-placement-viewport--contained-inline-start",
		);
		expect(imageViewportStyles).toContain("transform-origin: left center");
	});

	it("centers fallback symbols on both axes", () => {
		expect(cardMediaStyles).toContain(
			"$fallback-fade-reserve: $app-gap-md",
		);
		expect(cardMediaStyles).toContain("display: flex");
		expect(cardMediaStyles).toContain("box-sizing: border-box");
		expect(cardMediaStyles).toContain("width: 100%");
		expect(cardMediaStyles).toContain("height: 100%");
		expect(cardMediaStyles).toContain("align-items: center");
		expect(cardMediaStyles).toContain("justify-content: center");
		expect(cardMediaStyles).toContain(
			"padding-inline-end: $fallback-fade-reserve",
		);
		expect(cardMediaStyles).not.toContain("width: 52%");
		expect(cardMediaStyles).not.toContain("transform:");
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

	it("uses a curved fade that finishes before the media lane boundary", () => {
		expect(mediaLaneStyles).toMatch(
			/\$media-lane-fade-solid:\s*\d+%/,
		);
		expect(mediaLaneStyles).toMatch(
			/\$media-lane-fade-soft:\s*\d+%/,
		);
		expect(mediaLaneStyles).toMatch(
			/\$media-lane-fade-end:\s*\d+%/,
		);
		expect(mediaLaneStyles).toContain("$media-lane-mask: radial-gradient");
		expect(mediaLaneStyles).toMatch(
			/ellipse\s+\d+%\s+\d+%\s+at left center/,
		);
		expect(mediaLaneStyles).toMatch(
			/rgb\(0 0 0 \/ \d+%\)\s+\$media-lane-fade-soft/,
		);
		expect(mediaLaneStyles).toContain("mask-image: $media-lane-mask");
		expect(mediaLaneStyles).toContain(
			"-webkit-mask-image: $media-lane-mask",
		);
	});
});
