import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mixPage = readFileSync("src/routes/mix/+page.svelte", "utf8");
const ingredientChooser = readFileSync(
	"src/lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte",
	"utf8",
);
const selectedIngredients = readFileSync(
	"src/lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte",
	"utf8",
);
const ingredientChooserTypes = readFileSync(
	"src/lib/components/mix/ingredients/IngredientChooser/types.ts",
	"utf8",
);
const selectedIngredientsTypes = readFileSync(
	"src/lib/components/mix/ingredients/SelectedIngredientsPanel/types.ts",
	"utf8",
);
const headerController = readFileSync(
	"src/lib/utils/mix/state/mixHeaderVisibilityController.svelte.ts",
	"utf8",
);

describe("Mix compact header architecture", () => {
	it("uses only the main Mix surface to control the compact header", () => {
		expect(mixPage).toContain("<ViewFrame appShell>");
		expect(mixPage).toContain(
			"<ViewTop compactHidden={headerVisibility.state.hidden}>",
		);
		expect(mixPage).toContain("<ViewBody>");
		expect(mixPage).toContain("bind:this={mixScrollContainer}");
		expect(mixPage).toContain("onscroll={headerVisibility.handleScroll}");
		expect(mixPage).toContain("headerVisibility.observe(mixScrollContainer)");
		expect(headerController).toContain("tracker.pause(element.scrollTop)");
		expect(headerController).toContain("tracker.rebase(element.scrollTop)");
		expect(headerController).toContain("tracker.resume(element.scrollTop)");
		expect(mixPage).not.toContain("handleMixListScrollDirectionChange");
		expect(mixPage).not.toContain("onScrollDirectionChange=");
		expect(mixPage).not.toContain("document.addEventListener(\"scroll\"");

		for (const childList of [ingredientChooser, selectedIngredients]) {
			expect(childList).not.toContain("createScrollDirectionTracker");
			expect(childList).not.toContain("onscroll=");
			expect(childList).not.toContain("onScrollDirectionChange");
		}
		for (const propsType of [ingredientChooserTypes, selectedIngredientsTypes]) {
			expect(propsType).not.toContain("onScrollDirectionChange");
			expect(propsType).not.toContain("ScrollDirection");
		}
	});

	it("uses the shared route shell without stretching section rows", () => {
		const layout = readFileSync("src/routes/+layout.svelte", "utf8");
		const pageStyles = readFileSync("src/routes/mix/page.scss", "utf8");

		expect(layout).toContain("app-main--view-shell");
		expect(layout).toContain('page.url.pathname === "/mix"');
		expect(pageStyles).toContain("align-content: start;");
	});
});
