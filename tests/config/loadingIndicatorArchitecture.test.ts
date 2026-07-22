import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("loading indicator architecture", () => {
	it("keeps spinner drawing and animation in one shared component", () => {
		const search = read(
			"src/lib/components/ingredients/search/IngredientSearch.svelte",
		);
		const spinner = read(
			"src/lib/components/common/feedback/LoadingSpinner/LoadingSpinner.svelte",
		);
		const spinnerStyles = read(
			"src/lib/components/common/feedback/LoadingSpinner/LoadingSpinner.scss",
		);

		expect(search).toContain("LoadingSpinner");
		expect(search).not.toMatch(/class=["'][^"']*spinner/);
		expect(search).not.toMatch(/@keyframes[^\n]*spin/i);
		expect(spinnerStyles).toContain("@keyframes shared-loading-spin");
	});

	it("routes busy button states through the shared spinner", () => {
		for (const path of [
			"src/lib/components/common/buttons/ActionButton/ActionButton.svelte",
			"src/lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte",
			"src/lib/components/common/buttons/PillButton.svelte",
			"src/lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte",
			"src/lib/components/common/buttons/IconControlButton.svelte",
		]) {
			expect(read(path), path).toContain("LoadingSpinner");
		}
	});

	it("uses the shared input frame for barcode and category loading", () => {
		const identityStep = read(
			"src/lib/components/ingredients/manual-entry/steps/IdentityStep.svelte",
		);
		const categoryPicker = read(
			"src/lib/components/ingredients/manual-entry/FoodCategoryPicker/FoodCategoryPicker.svelte",
		);

		expect(identityStep).toContain("InputLoadingFrame");
		expect(identityStep).toContain('loadingLabel="Checking barcode sources"');
		expect(categoryPicker).toContain("InputLoadingFrame");
		expect(categoryPicker).toContain('loadingLabel="Searching categories"');
	});
});
