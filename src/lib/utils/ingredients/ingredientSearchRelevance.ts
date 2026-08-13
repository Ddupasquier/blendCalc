import type { FoodItem } from "$lib/utils/food/types";

const SEARCH_WORD_PATTERN = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
const EARLY_DESCRIPTION_WORD_LIMIT = 3;

type SearchRelevance = {
	tier: number;
	firstMatchPosition: number;
	lastMatchPosition: number;
	descriptionWordCount: number;
};

export const tokenizeIngredientSearchText = (value: string) =>
	value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.match(SEARCH_WORD_PATTERN) ?? [];

const getSearchRelevance = (
	description: string,
	searchWords: string[],
): SearchRelevance => {
	const descriptionWords = tokenizeIngredientSearchText(description);
	const matchPositions = searchWords.map((searchWord) =>
		descriptionWords.findIndex((descriptionWord) =>
			descriptionWord.startsWith(searchWord),
		),
	);
	const matchedPositions = matchPositions.filter((position) => position >= 0);
	const allWordsMatched = matchedPositions.length === searchWords.length;
	const startsWithSearch = allWordsMatched && searchWords.every(
		(searchWord, index) => (descriptionWords[index] ?? "").startsWith(searchWord),
	);
	const allMatchesAreEarly = allWordsMatched && matchPositions.every(
		(position) => position < EARLY_DESCRIPTION_WORD_LIMIT,
	);
	const hasEarlyMatch = matchedPositions.some(
		(position) => position < EARLY_DESCRIPTION_WORD_LIMIT,
	);

	let tier = 6;
	if (startsWithSearch) tier = 0;
	else if (allMatchesAreEarly) tier = 1;
	else if (allWordsMatched && hasEarlyMatch) tier = 2;
	else if (allWordsMatched) tier = 3;
	else if (hasEarlyMatch) tier = 4;
	else if (matchedPositions.length > 0) tier = 5;

	return {
		tier,
		firstMatchPosition: matchedPositions.length > 0
			? Math.min(...matchedPositions)
			: Number.MAX_SAFE_INTEGER,
		lastMatchPosition: matchedPositions.length > 0
			? Math.max(...matchedPositions)
			: Number.MAX_SAFE_INTEGER,
		descriptionWordCount: descriptionWords.length,
	};
};

const compareSearchRelevance = (
	left: SearchRelevance,
	right: SearchRelevance,
) =>
	left.tier - right.tier ||
	left.firstMatchPosition - right.firstMatchPosition ||
	left.lastMatchPosition - right.lastMatchPosition ||
	left.descriptionWordCount - right.descriptionWordCount;

export const createIngredientSearchRelevanceComparator = (query: string) => {
	const searchWords = tokenizeIngredientSearchText(query);
	const relevanceCache = new WeakMap<FoodItem, SearchRelevance>();
	const readRelevance = (food: FoodItem) => {
		const cached = relevanceCache.get(food);
		if (cached) return cached;
		const relevance = getSearchRelevance(food.description, searchWords);
		relevanceCache.set(food, relevance);
		return relevance;
	};

	return (left: FoodItem, right: FoodItem) => {
		if (searchWords.length === 0) return 0;
		return compareSearchRelevance(readRelevance(left), readRelevance(right));
	};
};

export const rankIngredientSearchCandidates = (
	foods: FoodItem[],
	query: string,
) => {
	const compareRelevance = createIngredientSearchRelevanceComparator(query);
	return foods
		.map((food, originalIndex) => ({ food, originalIndex }))
		.sort((left, right) =>
			compareRelevance(left.food, right.food) ||
			left.food.description.localeCompare(right.food.description) ||
			left.food.fdcId - right.food.fdcId ||
			left.originalIndex - right.originalIndex,
		)
		.map(({ food }) => food);
};
