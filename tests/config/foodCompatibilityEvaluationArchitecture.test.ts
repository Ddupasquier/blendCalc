import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("food compatibility evaluation architecture", () => {
	it("attaches one server-owned evaluation to personalized food reads", () => {
		const evaluation = readSource(
			"src/lib/server/food-safety/foodSafetyEvaluation.server.ts",
		);
		const ingredientPageData = readSource(
			"src/lib/server/user-data/ingredientPageData.server.ts",
		);
		const mixPageData = readSource(
			"src/lib/server/user-data/mixPageData.server.ts",
		);
		const searchRoute = readSource("src/routes/api/foods/search/+server.ts");
		const listRoute = readSource(
			"src/routes/api/user-food-lists/[list]/+server.ts",
		);

		expect(evaluation).toContain(
			"compatibilityEvaluation: getFoodCompatibilityEvaluation",
		);
		expect(ingredientPageData).toContain("annotateFoodsWithFoodSafety");
		expect(mixPageData).toContain("annotateFoodsWithFoodSafety");
		expect(searchRoute).toContain("annotateFoodsWithFoodSafety");
		expect(listRoute).toContain("annotateFoodsWithFoodSafety");
	});

	it("shares the bounded contract with blendCalcAPI v1 and nutrition presentation", () => {
		const api = readSource(
			"src/lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server.ts",
		);
		const panel = readSource(
			"src/lib/components/ingredients/nutrition/ProductCompatibilityPanel/ProductCompatibilityPanel.svelte",
		);

		expect(api).toContain(
			"const appCompatibilityEvaluation = getFoodCompatibilityEvaluation",
		);
		expect(api).toContain(
			"const compatibilityEvaluation: BlendCalcAPIV1CompatibilityEvaluation",
		);
		expect(api).toContain("hasActivePreferences: false");
		expect(panel).toContain("food.compatibilityEvaluation");
		expect(panel).toContain("getFoodCompatibilityEvaluationMessage");
	});

	it("evaluates safety before ranking and hydrates only the visible images", () => {
		const searchRoute = readSource("src/routes/api/foods/search/+server.ts");
		const mergeIndex = searchRoute.indexOf(
			"const mergedFoods = mergeIngredientSearchResults",
		);
		const imageHydrationIndex = searchRoute.indexOf(
			"await hydrateFoodsWithCachedImages",
		);
		const safetyEvaluationIndex = searchRoute.indexOf(
			"const foodsWithSafetyEvaluation = annotateFoodsWithFoodSafety",
			mergeIndex,
		);
		const rankingIndex = searchRoute.indexOf(
			"const foods = sortIngredientSearchResults",
			safetyEvaluationIndex,
		);

		expect(mergeIndex).toBeGreaterThan(-1);
		expect(safetyEvaluationIndex).toBeGreaterThan(mergeIndex);
		expect(rankingIndex).toBeGreaterThan(safetyEvaluationIndex);
		expect(imageHydrationIndex).toBeGreaterThan(rankingIndex);
	});
});
