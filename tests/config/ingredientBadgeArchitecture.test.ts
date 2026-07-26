import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ingredient badge architecture", () => {
	it("uses shared centered badges for actionable verification status", () => {
		const ingredientBadges = readFileSync(
			"src/lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte",
			"utf8",
		);
		const textBadge = readFileSync(
			"src/lib/components/common/badges/TextBadge/TextBadge.svelte",
			"utf8",
		);
		const textBadgeStyles = readFileSync(
			"src/lib/components/common/badges/TextBadge/TextBadge.scss",
			"utf8",
		);
		const nutritionFactsLabel = readFileSync(
			"src/lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.svelte",
			"utf8",
		);
		const verifiedStatusBadge = readFileSync(
			"src/lib/components/common/badges/VerifiedStatusBadge/VerifiedStatusBadge.svelte",
			"utf8",
		);
		const shieldCheck = readFileSync(
			"src/lib/assets/icons/ShieldCheck/ShieldCheck.svelte",
			"utf8",
		);
		const savedIngredientCard = readFileSync(
			"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte",
			"utf8",
		);
		const ingredientSearchCard = readFileSync(
			"src/lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte",
			"utf8",
		);

		expect(ingredientBadges).toContain(
			'$lib/components/common/badges/TextBadge/TextBadge.svelte',
		);
		expect(ingredientBadges).toContain(
			'$lib/components/common/badges/VerifiedStatusBadge/VerifiedStatusBadge.svelte',
		);
		expect(ingredientBadges).toContain('variant === "saved-card"');
		expect(ingredientBadges).toContain(
			'visibleTrustBadge.value === "verified"',
		);
		expect(ingredientBadges).not.toContain("getIngredientSourceBadge");
		expect(ingredientBadges).not.toContain('class="ingredient-card-badge"');
		expect(textBadgeStyles).toContain("place-items: center");
		expect(textBadgeStyles).toContain("min-height: 1.25rem");
		expect(textBadgeStyles).toContain("text-align: center");
		expect(verifiedStatusBadge).toContain(
			'$lib/components/common/badges/StatusIconBadge/StatusIconBadge.svelte',
		);
		expect(verifiedStatusBadge).toContain(
			'$lib/assets/icons/ShieldCheck/ShieldCheck.svelte',
		);
		expect(verifiedStatusBadge).toContain('tone="success"');
		expect(shieldCheck).toContain('viewBox="0 0 24 24"');
		expect(shieldCheck).toContain('stroke="currentColor"');
		expect(nutritionFactsLabel).toContain(
			'$lib/components/ingredients/provenance/IngredientProvenanceBadges/IngredientProvenanceBadges.svelte',
		);
		expect(nutritionFactsLabel).not.toContain("CustomBadge");
		expect(nutritionFactsLabel).not.toContain('variant="saved-card"');
		expect(savedIngredientCard).toContain('variant="saved-card"');
		expect(ingredientSearchCard).toContain('variant="search-card"');
	});
});
