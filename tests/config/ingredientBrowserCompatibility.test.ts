import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
	readFileSync(resolve(process.cwd(), path), "utf8");

describe("ingredient browser compatibility baseline", () => {
	it("declares the supported build targets", () => {
		const viteConfig = readSource("vite.config.ts");
		for (const target of ["chrome111", "edge111", "firefox113", "safari16.4"]) {
			expect(viteConfig).toContain(target);
		}
	});

	it("uses safe-area support and a viewport-height fallback", () => {
		const appHtml = readSource("src/app.html");
		const viewFrameStyles = readSource(
			"src/lib/components/common/view/ViewFrame/ViewFrame.scss",
		);
		expect(appHtml).toContain("viewport-fit=cover");
		expect(viewFrameStyles.indexOf("100vh")).toBeLessThan(
			viewFrameStyles.indexOf("100dvh"),
		);
	});

	it("does not rely on :has for the ingredients page shell", () => {
		const fridgePage = readSource(
			"src/routes/ingredients/fridge/+page.svelte",
		);
		expect(fridgePage).not.toContain(":has(");
		expect(readSource("src/routes/+layout.svelte")).toContain(
			"app-main--ingredients",
		);
	});

	it("does not refresh page data when the browser merely regains focus", () => {
		const pages = [
			readSource("src/routes/ingredients/fridge/+page.svelte"),
			readSource("src/routes/mix/+page.svelte"),
		];

		for (const page of pages) {
			expect(page).not.toMatch(
				/window\.addEventListener\(\s*["']focus["']/,
			);
			expect(page).toContain("SMOOTHIE_LISTS_CHANGED_EVENT");
		}
	});
});
