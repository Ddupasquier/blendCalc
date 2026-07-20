import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ingredient badge architecture", () => {
	it("uses shared centered badges for actionable verification status", () => {
		const ingredientBadges = readFileSync(
			"src/lib/components/ingredients/provenance/IngredientProvenanceBadges.svelte",
			"utf8",
		);
		const textBadge = readFileSync(
			"src/lib/components/common/badges/TextBadge.svelte",
			"utf8",
		);
		const nutritionFactsLabel = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionFactsLabel.svelte",
			"utf8",
		);
		const verifiedStatusBadge = readFileSync(
			"src/lib/components/common/badges/VerifiedStatusBadge.svelte",
			"utf8",
		);
		const shieldCheck = readFileSync(
			"src/lib/assets/icons/ShieldCheck.svelte",
			"utf8",
		);

		expect(ingredientBadges).toContain(
			'$lib/components/common/badges/TextBadge.svelte',
		);
		expect(ingredientBadges).toContain(
			'$lib/components/common/badges/VerifiedStatusBadge.svelte',
		);
		expect(ingredientBadges).toContain('trustBadge.value === "verified"');
		expect(ingredientBadges).not.toContain("getIngredientSourceBadge");
		expect(ingredientBadges).not.toContain('class="ingredient-card-badge"');
		expect(textBadge).toContain("place-items: center");
		expect(textBadge).toContain("min-height: $app-text-badge-min-height");
		expect(textBadge).toContain("text-align: center");
		expect(verifiedStatusBadge).toContain(
			'$lib/components/common/badges/StatusIconBadge.svelte',
		);
		expect(verifiedStatusBadge).toContain(
			'$lib/assets/icons/ShieldCheck.svelte',
		);
		expect(verifiedStatusBadge).toContain('tone="success"');
		expect(shieldCheck).toContain('viewBox="0 0 24 24"');
		expect(shieldCheck).toContain('stroke="currentColor"');
		expect(nutritionFactsLabel).toContain(
			'$lib/components/ingredients/provenance/IngredientProvenanceBadges.svelte',
		);
		expect(nutritionFactsLabel).not.toContain("CustomBadge");
	});
});
