import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const savedCard = readFileSync(
	"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte",
	"utf8",
);
const searchCards = readFileSync(
	"src/lib/components/ingredients/search/SearchDropdown/SearchDropdown.svelte",
	"utf8",
);
const provenanceBadges = readFileSync(
	"src/lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte",
	"utf8",
);
const warningEdge = readFileSync(
	"src/lib/components/common/display/CardWarningEdge/CardWarningEdge.svelte",
	"utf8",
);
const warningEdgeStyles = readFileSync(
	"src/lib/components/common/display/CardWarningEdge/CardWarningEdge.scss",
	"utf8",
);

describe("ingredient warning card architecture", () => {
	it("uses the shared edge treatment on saved and search cards", () => {
		expect(savedCard).toContain("<CardWarningEdge />");
		expect(searchCards).toContain("<CardWarningEdge />");
		expect(warningEdge).toContain('class="card-warning-edge"');
		expect(warningEdgeStyles).toContain("width: 5px");
		expect(warningEdgeStyles).toContain("background: $app-highlight");
	});

	it("does not render warning icons inside compact card badges", () => {
		expect(provenanceBadges).not.toContain("WarningTriangle");
		expect(provenanceBadges).not.toContain("warning = null");
		expect(savedCard).not.toMatch(/<IngredientProvenanceBadges[^>]*\bwarning=/);
		expect(searchCards).not.toMatch(/<IngredientProvenanceBadges[^>]*\bwarning=/);
	});
});
