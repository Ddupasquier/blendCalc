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
const placementPreview = readFileSync(
	"src/lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.svelte",
	"utf8",
);
const placementInteraction = readFileSync(
	"src/lib/components/common/images/ImagePlacementCardPreview/imagePlacementInteraction.ts",
	"utf8",
);
const cardLayoutStyles = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMediaLane/_IngredientCardLayout.scss",
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
		expect(cardLayoutStyles).toContain("$card-media-lane-width: 28cqw");
		expect(cardLayoutStyles).toContain("$card-content-inset: 18cqw");
		expect(cardLayoutStyles).toContain("$card-title-shift: $app-gap-lg");
		expect(cardLayoutStyles).toContain(
			"$card-supporting-copy-indent: $app-gap-sm",
		);
		expect(cardLayoutStyles).toContain(
			"margin-inline-start: -$card-title-shift",
		);
		expect(cardLayoutStyles).toContain(
			"-#{$card-title-shift} + #{$card-supporting-copy-indent}",
		);
		expect(cardLayoutStyles).toContain(
			"--ingredient-card-copy-start-offset",
		);
		expect(cardLayoutStyles).toMatch(
			/--ingredient-card-copy-start-offset:[\s\S]*var\(--ingredient-card-content-inset\)[\s\S]*-\s*#\{\$card-title-shift\}/,
		);
		expect(cardLayoutStyles).toContain("container-type: inline-size");
		expect(savedCardStyles).toContain(
			"@include ingredient-card-layout.frame",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-layout.frame",
		);
		expect(placementPreviewStyles).toContain(
			"@include ingredient-card-layout.frame",
		);
		expect(savedCardStyles).toContain(
			"@include ingredient-card-layout.media-content-inset",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-layout.media-content-inset",
		);
		expect(placementPreviewStyles).toContain(
			"@include ingredient-card-layout.media-content-inset",
		);
		expect(placementPreviewStyles).not.toContain("max-width");
	});

	it("shares compact-card copy, focus, and action layout without a prop-forwarding wrapper", () => {
		expect(cardLayoutStyles).toContain("@mixin primary-action-target");
		expect(cardLayoutStyles).toContain("@mixin primary-action-focus");
		expect(cardLayoutStyles).toContain("@mixin presentation-layer");
		expect(cardLayoutStyles).toContain("@mixin copy");
		expect(cardLayoutStyles).toContain("@mixin title-row");
		expect(cardLayoutStyles).toContain("@mixin action-layer");
		expect(cardLayoutStyles).toContain("@mixin action-row");
		expect(savedCardStyles).toContain(
			"@include ingredient-card-layout.copy",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-layout.copy",
		);
		expect(savedCardStyles).toContain(
			"@include ingredient-card-layout.primary-action-target",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-layout.primary-action-target",
		);
		expect(savedCardStyles).toContain(
			"@include ingredient-card-layout.presentation-layer",
		);
		expect(searchCardStyles).toContain(
			"@include ingredient-card-layout.presentation-layer",
		);
		expect(placementPreviewStyles).toContain(
			"@include ingredient-card-layout.copy",
		);
		expect(savedCard).not.toContain("IngredientCardActions");
	});

	it("uses the exact card preview in user and privileged placement flows", () => {
		expect(imagePlacementEditor).toContain("<ImagePlacementCardPreview");
		expect(imagePlacementEditor).toContain("{showWarningEdge}");
		expect(productImageEvidenceInput).toContain("<ImagePlacementEditor");
		expect(productImagePanel).toContain("<ImagePlacementEditor");
		expect(productImagePanel).toContain("{showWarningEdge}");
		expect(moderationPage).toContain("<ImagePlacementEditor");
	});

	it("uses shared left-only geometry for card rendering and placement previews", () => {
		expect(mediaLane).toContain('horizontalMovement="left-only"');
		expect(imageViewport).toContain("horizontalMovement,");
		expect(placementPreview).toContain("createImagePlacementInteraction");
		expect(placementPreview).toContain("onpointerdown=");
		expect(placementInteraction).toContain("moveImagePlacement");
		expect(imageViewport).not.toContain("onpointerdown=");
		expect(imageViewportStyles).not.toContain(
			".image-placement-viewport--contained-inline-start",
		);
	});

	it("centers fallback symbols between the card edge and shifted title start", () => {
		expect(cardMediaStyles).toContain("display: grid");
		expect(cardMediaStyles).toContain("box-sizing: border-box");
		expect(cardMediaStyles).toContain(
			"width: min(100%, var(--ingredient-card-copy-start-offset))",
		);
		expect(cardMediaStyles).toContain("height: 100%");
		expect(cardMediaStyles).toContain("place-items: center");
		expect(cardMediaStyles).not.toContain("padding-inline");
		expect(cardMediaStyles).not.toContain("$fallback-fade-reserve");
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

	it("uses a configurable curved fade that finishes before the media lane boundary", () => {
		const horizontalRadius = Number(
			mediaLaneStyles.match(
				/\$media-lane-mask-horizontal-radius:\s*(\d+)%/,
			)?.[1],
		);
		const verticalRadius = Number(
			mediaLaneStyles.match(
				/\$media-lane-mask-vertical-radius:\s*(\d+)%/,
			)?.[1],
		);

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
		expect(mediaLaneStyles).toContain(
			"ellipse $media-lane-mask-horizontal-radius $media-lane-mask-vertical-radius at left center",
		);
		expect(horizontalRadius).toBe(100);
		expect(verticalRadius).toBe(140);
		expect(mediaLaneStyles).toMatch(
			/rgb\(0 0 0 \/ \d+%\)\s+\$media-lane-fade-soft/,
		);
		expect(mediaLaneStyles).toContain("mask-image: $media-lane-mask");
		expect(mediaLaneStyles).toContain(
			"-webkit-mask-image: $media-lane-mask",
		);
	});
});
