import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("loading indicator architecture", () => {
	it("keeps spinner drawing and animation in one shared component", () => {
		const search = read(
			"src/lib/components/ingredients/search/IngredientSearch/IngredientSearch.svelte",
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
			"src/lib/components/common/buttons/PillButton/PillButton.svelte",
			"src/lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte",
			"src/lib/components/common/buttons/IconControlButton/IconControlButton.svelte",
		]) {
			expect(read(path), path).toContain("LoadingSpinner");
		}
	});

	it("uses the shared input frame for barcode and category loading", () => {
		const identityStep = read(
			"src/lib/components/ingredients/manual-entry/steps/IdentityStep/IdentityStep.svelte",
		);
		const manualEntryFieldStyles = read(
			"src/lib/components/ingredients/manual-entry/ManualEntryField/ManualEntryField.scss",
		);
		const categoryPicker = read(
			"src/lib/components/ingredients/manual-entry/FoodCategoryPicker/FoodCategoryPicker.svelte",
		);

		expect(identityStep).toContain("InputLoadingFrame");
		expect(identityStep).toContain('loadingLabel="Checking barcode sources"');
		expect(manualEntryFieldStyles).toContain(
			".manual-entry-field > .input-loading-frame > input",
		);
		expect(categoryPicker).toContain("InputLoadingFrame");
		expect(categoryPicker).toContain('loadingLabel="Searching categories"');
	});

	it("uses the shared spinner while a scanned product is loading", () => {
		const shareStep = read(
			"src/lib/components/ingredients/manual-entry/steps/ShareStep/ShareStep.svelte",
		);

		expect(shareStep).toContain("LoadingSpinner");
		expect(shareStep).toContain("Finding product details");
		expect(shareStep).not.toMatch(/class=["'][^"']*spinner/);
		expect(shareStep).not.toMatch(/@keyframes[^\n]*spin/i);
	});

	it("protects authenticator recovery sign-out from duplicate submissions", () => {
		const recoveryPage = read("src/routes/auth/mfa/recovery/+page.svelte");

		expect(recoveryPage).toContain("createPendingSubmit");
		expect(recoveryPage).toContain("use:enhance={preventDuplicateSignOut}");
		expect(recoveryPage).toContain("busy={isSigningOut}");
	});
});
