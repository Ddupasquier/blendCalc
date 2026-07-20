import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const savedCard = readFileSync(
	"src/lib/components/ingredients/list/SavedIngredientCard.svelte",
	"utf8",
);
const searchCards = readFileSync(
	"src/lib/components/ingredients/search/SearchDropdown.svelte",
	"utf8",
);
const provenanceBadges = readFileSync(
	"src/lib/components/ingredients/provenance/IngredientProvenanceBadges.svelte",
	"utf8",
);
const cardStyles = readFileSync(
	"src/styles/_ingredient-cards.scss",
	"utf8",
);

describe("ingredient warning card architecture", () => {
	it("uses the shared edge treatment on saved and search cards", () => {
		expect(savedCard).toContain("@include ingredient-cards.warning-edge");
		expect(searchCards).toContain("@include ingredient-cards.warning-edge");
		expect(cardStyles).toContain("$ingredient-card-warning-bar-width");
		expect(cardStyles).toContain("$ingredient-card-warning-bar-color");
	});

	it("does not render warning icons inside compact card badges", () => {
		expect(provenanceBadges).not.toContain("WarningTriangle");
		expect(provenanceBadges).not.toContain("warning = null");
		expect(savedCard).not.toMatch(/<IngredientProvenanceBadges[^>]*\bwarning=/);
		expect(searchCards).not.toMatch(/<IngredientProvenanceBadges[^>]*\bwarning=/);
	});
});
