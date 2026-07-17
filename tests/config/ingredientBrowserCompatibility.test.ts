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
		const viewFrame = readSource(
			"src/lib/components/common/view/ViewFrame.svelte",
		);
		expect(appHtml).toContain("viewport-fit=cover");
		expect(viewFrame.indexOf("100vh")).toBeLessThan(
			viewFrame.indexOf("100dvh"),
		);
	});

	it("does not rely on :has for the ingredients page shell", () => {
		const fridgePage = readSource("src/routes/fridge/+page.svelte");
		expect(fridgePage).not.toContain(":has(");
		expect(readSource("src/routes/+layout.svelte")).toContain(
			"app-main--ingredients",
		);
	});
});
