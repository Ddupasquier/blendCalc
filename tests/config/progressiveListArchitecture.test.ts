import { existsSync, globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("progressive list architecture", () => {
	it("keeps numbered pagination out of the user-facing application", () => {
		const sourceFiles = globSync("src/**/*.svelte");
		const numberedPaginationConsumers = sourceFiles.filter((path) => {
			const source = readFileSync(path, "utf8");
			return (
				source.includes("components/common/lists/Pagination") ||
				source.includes("<Pagination")
			);
		});

		expect(numberedPaginationConsumers).toEqual([]);
		expect(
			existsSync("src/lib/components/common/lists/Pagination"),
		).toBe(false);
	});

	it("uses the shared explicit controls in both Mix ingredient lists", () => {
		const componentPaths = [
			"src/lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte",
			"src/lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte",
		];

		for (const path of componentPaths) {
			const source = readFileSync(path, "utf8");
			expect(source).toContain("<PaginatedListControls");
			expect(source).not.toMatch(/currentPage|onPageChange|pageSize=/);
		}
	});

	it("lets Mix page scrolling continue past nested-list boundaries", () => {
		for (const path of [
			"src/lib/components/mix/ingredients/IngredientChooser/IngredientChooser.scss",
			"src/lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.scss",
		]) {
			const styles = readFileSync(path, "utf8");
			expect(styles, path).toContain("overscroll-behavior-y: auto");
			expect(styles, path).not.toMatch(/overscroll-behavior(?:-y)?:\s*contain/);
		}
	});
});
