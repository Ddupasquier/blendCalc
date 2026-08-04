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

describe("Mix compact header architecture", () => {
	it("uses the shared app-shell scroll-away contract", () => {
		expect(mixPage).toContain("<ViewFrame appShell>");
		expect(mixPage).toContain("<ViewTop compactHidden={compactTopHidden}>");
		expect(mixPage).toContain("<ViewBody>");
		expect(mixPage).toContain("bind:this={mixScrollContainer}");
		expect(mixPage).toContain("onscroll={handleMixPageScroll}");
		expect(mixPage).toContain(
			"mixPageScrollDirectionTracker.pause(element.scrollTop)",
		);
		expect(mixPage).toContain(
			"mixPageScrollDirectionTracker.rebase(element.scrollTop)",
		);
		expect(mixPage).toContain(
			"mixPageScrollDirectionTracker.resume(element.scrollTop)",
		);
		expect(mixPage).toContain(
			"onScrollDirectionChange={handleMixListScrollDirectionChange}",
		);
		expect(mixPage).not.toContain("document.addEventListener(\"scroll\"");

		for (const scrollOwner of [ingredientChooser, selectedIngredients]) {
			expect(scrollOwner).toContain("createScrollDirectionTracker");
			expect(scrollOwner).toContain("onscroll={handleListScroll}");
			expect(scrollOwner).toContain("scrollDirectionTracker.pause(element.scrollTop)");
			expect(scrollOwner).toContain("scrollDirectionTracker.rebase(element.scrollTop)");
			expect(scrollOwner).toContain("scrollDirectionTracker.resume(element.scrollTop)");
			expect(scrollOwner).toContain("new ResizeObserver");
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
