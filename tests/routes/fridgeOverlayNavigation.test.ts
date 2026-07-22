import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fridgePagePath = resolve(process.cwd(), "src/routes/fridge/+page.svelte");

describe("fridge overlay navigation", () => {
	it("uses shallow history so sheets do not remount the ingredient list", () => {
		const source = readFileSync(fridgePagePath, "utf8");

		expect(source).toContain("pushState(href, nextPageState)");
		expect(source).toContain("replaceNavigationState(href, nextPageState)");
		expect(source).not.toContain("goto(href");
	});

	it("pauses automatic list expansion while an overlay is open", () => {
		const source = readFileSync(fridgePagePath, "utf8");

		expect(source).toContain("const ingredientOverlayOpen = $derived(");
		expect(source).toContain("revealPaused={ingredientOverlayOpen}");
	});

	it("uses the URL as the only source of truth for the active list tab", () => {
		const source = readFileSync(fridgePagePath, "utf8");

		expect(source).toContain(
			"let activeList = $derived<SmoothieListKey>(getIngredientListTab(page.url))",
		);
		expect(source).not.toContain("const selectList =");
		expect(source).not.toContain("activeList = key");
	});
});
