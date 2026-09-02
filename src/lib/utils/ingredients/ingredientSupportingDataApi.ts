import type { IngredientPageSupportingData } from "$lib/types/pageData/ingredientPageData";

export const readIngredientPageSupportingData = async (
	fetcher: typeof fetch = fetch,
): Promise<IngredientPageSupportingData> => {
	const response = await fetcher("/api/ingredients/supporting-data", {
		headers: { accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error("Ingredient supporting data could not be loaded.");
	}
	return (await response.json()) as IngredientPageSupportingData;
};
