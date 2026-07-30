import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ingredientsPagePath = resolve(
	process.cwd(),
	"src/routes/ingredients/fridge/+page.svelte",
);
const ingredientListTabsPath = resolve(
	process.cwd(),
	"src/lib/components/ingredients/list/IngredientListTabs/IngredientListTabs.svelte",
);

describe("ingredient overlay navigation", () => {
	it("uses explicit canonical list and overlay route files", () => {
		const expectedRoutes = [
			"src/routes/ingredients/fridge/+page.svelte",
			"src/routes/ingredients/shopping/+page.svelte",
			"src/routes/ingredients/fridge/search/+page.svelte",
			"src/routes/ingredients/shopping/search/+page.svelte",
			"src/routes/ingredients/fridge/manual-entry/+page.svelte",
			"src/routes/ingredients/shopping/manual-entry/+page.svelte",
			"src/routes/ingredients/fridge/nutrition/[foodId=signedInteger]/+page.svelte",
			"src/routes/ingredients/shopping/nutrition/[foodId=signedInteger]/+page.svelte",
		];

		for (const route of expectedRoutes) {
			expect(existsSync(resolve(process.cwd(), route)), route).toBe(true);
		}
		expect(
			existsSync(resolve(process.cwd(), "src/routes/fridge")),
		).toBe(false);
		expect(
			existsSync(resolve(process.cwd(), "src/routes/ingredients/[...slug]")),
		).toBe(false);
	});

	it("uses shallow history so sheets do not remount the ingredient list", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");

		expect(source).toContain("pushState(href, nextPageState)");
		expect(source).toContain("replaceNavigationState(href, nextPageState)");
		expect(source).not.toContain("goto(href");
	});

	it("pauses automatic list expansion while an overlay is open", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");

		expect(source).toContain("const ingredientOverlayOpen = $derived(");
		expect(source).toContain("revealPaused={ingredientOverlayOpen}");
	});

	it("does not replay a stale barcode scan when manual entry is reopened", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");
		const openManualEntry = source.match(
			/const openManualEntry = \(\) => \{[\s\S]*?\n    \};/,
		)?.[0];

		expect(openManualEntry).toContain("barcodeScannerRouteOpen = false;");
		expect(openManualEntry).toContain("scanSignal = 0;");
		expect(openManualEntry).toContain("modal: null,");
		expect(source).toMatch(
			/routeState\.modal === INGREDIENT_ROUTE_MODALS\.barcodeScanner[\s\S]*?\} else \{\s*barcodeScannerRouteOpen = false;\s*scanSignal = 0;/,
		);
	});

	it("uses the URL as the only source of truth for the active list tab", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");

		expect(source).toContain(
			"let activeList = $derived<SmoothieListKey>(getIngredientListTab(page.url))",
		);
		expect(source).not.toContain("const selectList =");
		expect(source).not.toContain("activeList = key");
	});

	it("uses route links rather than shallow history for primary list tabs", () => {
		const source = readFileSync(ingredientListTabsPath, "utf8");

		expect(source).toContain("href: buildIngredientListTabHref(");
		expect(source).not.toContain('from "$app/navigation"');
		expect(source).not.toContain("pushState(");
	});
});
