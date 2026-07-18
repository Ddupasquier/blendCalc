import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ingredient badge architecture", () => {
	it("uses the shared centered text badge for source and review labels", () => {
		const ingredientBadges = readFileSync(
			"src/lib/components/ingredients/list/IngredientCardBadges.svelte",
			"utf8",
		);
		const textBadge = readFileSync(
			"src/lib/components/common/badges/TextBadge.svelte",
			"utf8",
		);

		expect(ingredientBadges).toContain(
			'$lib/components/common/badges/TextBadge.svelte',
		);
		expect(ingredientBadges.match(/<TextBadge/g)).toHaveLength(2);
		expect(ingredientBadges).not.toContain('class="ingredient-card-badge"');
		expect(textBadge).toContain("place-items: center");
		expect(textBadge).toContain("min-height: $app-text-badge-min-height");
		expect(textBadge).toContain("text-align: center");
	});
});
