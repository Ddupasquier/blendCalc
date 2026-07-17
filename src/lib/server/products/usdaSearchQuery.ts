import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";

const MAX_SEARCH_TERMS = 6;

const getSearchTerms = (query: string) =>
	tokenizeIngredientSearchText(query).slice(0, MAX_SEARCH_TERMS);

export const buildUsdaExactSearchQuery = (query: string) =>
	getSearchTerms(query).map((term) => `+${term}`).join(" ");

export const buildUsdaPartialSearchQuery = (query: string) => {
	return getSearchTerms(query).map((term) => `+${term}*`).join(" ");
};
