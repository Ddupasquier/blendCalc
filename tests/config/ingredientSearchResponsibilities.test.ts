import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
	"src/lib/components/ingredients/search/IngredientSearch/IngredientSearch.svelte",
	"utf8",
);
const requestControllerSource = readFileSync(
	"src/lib/components/ingredients/search/IngredientSearch/ingredientSearchRequestController.svelte.ts",
	"utf8",
);

describe("Ingredient search responsibilities", () => {
	it("keeps request and pagination ownership outside the combobox component", () => {
		expect(componentSource).toContain(
			"createIngredientSearchRequestController",
		);
		expect(componentSource).not.toContain("searchFoodPage");
		expect(componentSource).not.toContain("AbortController");

		expect(requestControllerSource).toContain("searchFoodPage");
		expect(requestControllerSource).toContain("AbortController");
		expect(requestControllerSource).not.toContain("SearchDropdown");
	});
});
