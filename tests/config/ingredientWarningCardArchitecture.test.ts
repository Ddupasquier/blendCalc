import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const savedCard = readFileSync(
	"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte",
	"utf8",
);
const searchCards = readFileSync(
	"src/lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte",
	"utf8",
);
const mixAmountCard = readFileSync(
	"src/lib/components/mix/ingredients/MixIngredientAmountCard/MixIngredientAmountCard.svelte",
	"utf8",
);
const mixOptionCard = readFileSync(
	"src/lib/components/mix/ingredients/MixIngredientOption/MixIngredientOption.svelte",
	"utf8",
);
const placementPreview = readFileSync(
	"src/lib/components/common/images/ImagePlacementCardPreview/ImagePlacementCardPreview.svelte",
	"utf8",
);
const cardMedia = readFileSync(
	"src/lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte",
	"utf8",
);
const provenanceBadges = readFileSync(
	"src/lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte",
	"utf8",
);
const warningFrame = readFileSync(
	"src/lib/components/common/display/CardWarningFrame/CardWarningFrame.svelte",
	"utf8",
);
const warningFrameStyles = readFileSync(
	"src/lib/components/common/display/CardWarningFrame/CardWarningFrame.scss",
	"utf8",
);

describe("ingredient warning card architecture", () => {
	it("uses one shared rounded warning frame across compact food cards", () => {
		for (const cardSource of [
			savedCard,
			searchCards,
			mixAmountCard,
			mixOptionCard,
			placementPreview,
		]) {
			expect(cardSource).toContain("<CardWarningFrame");
			expect(cardSource).not.toContain("<CardWarningEdge");
		}
		expect(warningFrame).toContain('class="card-warning-frame"');
		expect(warningFrame).toContain("data-tone={tone}");
		expect(warningFrameStyles).toContain("border: 3px solid transparent");
		expect(warningFrameStyles).toContain(
			"--card-warning-frame-fade-angle: 45deg",
		);
		expect(warningFrameStyles).toContain(
			"--card-warning-frame-solid-stop: 16%",
		);
		expect(warningFrameStyles).toContain("--card-warning-frame-fade-end: 55%");
		expect(warningFrameStyles).toContain("mask-composite: exclude");
		expect(warningFrameStyles).toContain(
			"--card-warning-frame-color: #{$app-shell-accent-danger}",
		);
	});

	it("does not render warning icons inside compact card badges", () => {
		expect(provenanceBadges).not.toContain("WarningTriangle");
		expect(provenanceBadges).not.toContain("warning = null");
		expect(savedCard).not.toMatch(/<IngredientProvenanceBadges[^>]*\bwarning=/);
		expect(searchCards).not.toMatch(
			/<IngredientProvenanceBadges[^>]*\bwarning=/,
		);
	});

	it("shares full-height image and fallback media without circular card wrappers", () => {
		expect(savedCard).toContain("<IngredientCardMedia {food} />");
		expect(searchCards).toContain("<IngredientCardMedia {food} />");
		expect(cardMedia).toContain("<IngredientCardMediaLane");
		expect(cardMedia).toContain("<FoodSymbol food={fallbackFood} />");
		expect(savedCard).not.toContain("CircularMediaFrame");
		expect(searchCards).not.toContain("CircularMediaFrame");
	});
});
