import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sectionComponents = [
	"src/lib/components/mix/insights/NutrientShapePanel/NutrientShapePanel.svelte",
	"src/lib/components/mix/controls/GoalTargets/GoalTargets.svelte",
	"src/lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte",
	"src/lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte",
	"src/lib/components/mix/insights/SmartWarnings/SmartWarnings.svelte",
	"src/lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte",
	"src/lib/components/mix/insights/IngredientContributionBreakdown/IngredientContributionBreakdown.svelte",
];

const sectionStyles = [
	"src/lib/components/mix/insights/NutrientShapePanel/NutrientShapePanel.scss",
	"src/lib/components/mix/controls/GoalTargets/GoalTargets.scss",
	"src/lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.scss",
	"src/lib/components/mix/ingredients/IngredientChooser/IngredientChooser.scss",
	"src/lib/components/mix/insights/SmartWarnings/SmartWarnings.scss",
	"src/lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.scss",
	"src/lib/components/mix/insights/IngredientContributionBreakdown/IngredientContributionBreakdown.scss",
];

const warningSection =
	"src/lib/components/mix/insights/SmartWarnings/SmartWarnings.svelte";
const warningStyles =
	"src/lib/components/mix/insights/SmartWarnings/SmartWarnings.scss";

describe("Mix section disclosure architecture", () => {
	it("routes every top-level Mix section through the controlled shared disclosure", () => {
		for (const path of sectionComponents) {
			const source = readFileSync(path, "utf8");
			expect(source, path).toContain("CollapsibleSection");
			expect(source, path).toContain("onOpenChange");
			expect(source, path).toMatch(/<CollapsibleSection[\s\S]*\{open\}/);
		}
	});

	it("loads and saves disclosure state through the Mix preference boundary", () => {
		const page = readFileSync("src/routes/mix/+page.svelte", "utf8");
		const repository = readFileSync(
			"src/lib/utils/storage/supabase/mixPreferences.ts",
			"utf8",
		);

		expect(page).toContain("normalizeMixSectionDisclosureState");
		expect(page).toContain("saveCloudMixSectionDisclosureState");
		expect(repository).toContain("section_disclosure_state");
		expect(repository).toContain("save_mix_section_disclosure_state");
	});

	it("keeps top-level Mix disclosure shells compact without shrinking the shared target", () => {
		for (const path of sectionStyles) {
			const source = readFileSync(path, "utf8");
			expect(source, path).toContain("padding: $app-gap-sm;");
			expect(source, path).toContain("padding: $app-gap-xs;");
			expect(source, path).not.toContain("padding: $app-shell-card-padding;");
			expect(source, path).not.toContain("padding: $app-shell-card-padding-compact;");
		}
	});

	it("keeps collapse headers neutral and reserves section highlighting for Warnings", () => {
		for (const path of sectionComponents) {
			const source = readFileSync(path, "utf8");
			const disclosureTag = source.match(/<CollapsibleSection[\s\S]*?>/)?.[0];
			expect(disclosureTag, path).toBeDefined();
			expect(disclosureTag, path).not.toContain("tone=");
		}

		const warningSource = readFileSync(warningSection, "utf8");
		expect(warningSource).toContain("data-tone={resolvedAttentionTone}");
		expect(warningSource).toContain('class="smart-warnings__disclosure"');
	});

	it("uses the standard panel surface inside Warnings and borders cards by severity", () => {
		const source = readFileSync(warningStyles, "utf8");
		const warningCard = source.match(/\.smart-warning \{[\s\S]*?\n\}/)?.[0];
		const dangerCard = source.match(/\.smart-warning--danger \{[\s\S]*?\n\}/)?.[0];

		expect(warningCard).toContain("background: $app-shell-surface-panel;");
		expect(warningCard).toContain("border: $app-warning-border;");
		expect(dangerCard).toContain("border-color: $app-shell-accent-danger;");
		expect(dangerCard).not.toContain("background:");
	});

	it("keeps the Nutrient shape summary free of redundant status pills", () => {
		const source = readFileSync(sectionComponents[0], "utf8");
		const disclosureTag = source.match(/<CollapsibleSection[\s\S]*?>/)?.[0];
		expect(disclosureTag).toBeDefined();
		expect(disclosureTag).not.toContain("badge=");
		expect(source).toContain("nutrient-shape-panel__statuses");
	});
});
