import type { FoodItem } from "$lib/utils/food/types";

const SEARCH_WORD_PATTERN = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
const EARLY_DESCRIPTION_WORD_LIMIT = 3;

type SearchRelevance = {
	fieldPriority: number;
	tier: number;
	firstMatchPosition: number;
	lastMatchPosition: number;
	fieldWordCount: number;
};

type SearchableFoodField = {
	priority: number;
	value: string;
};

export const tokenizeIngredientSearchText = (value: string) =>
	value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.match(SEARCH_WORD_PATTERN) ?? [];

const getSearchRelevance = (
	value: string,
	searchWords: string[],
): Omit<SearchRelevance, "fieldPriority"> => {
	const fieldWords = tokenizeIngredientSearchText(value);
	const matchPositions = searchWords.map((searchWord) =>
		fieldWords.findIndex((fieldWord) =>
			fieldWord.startsWith(searchWord),
		),
	);
	const matchedPositions = matchPositions.filter((position) => position >= 0);
	const allWordsMatched = matchedPositions.length === searchWords.length;
	const startsWithSearch = allWordsMatched && searchWords.every(
		(searchWord, index) => (fieldWords[index] ?? "").startsWith(searchWord),
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
		fieldWordCount: fieldWords.length,
	};
};

const joinSearchValues = (values: Array<string | undefined>) =>
	values
		.map((value) => value?.trim() ?? "")
		.filter(Boolean)
		.join(" ");

const getSearchableFoodFields = (food: FoodItem): SearchableFoodField[] => {
	const categoryText = joinSearchValues([
		food.foodCategory,
		food.brandedFoodCategory,
		...(food.categories ?? []),
	]);
	const organizationText = joinSearchValues(
		(food.safetyAlerts ?? []).map((alert) => alert.recallingOrganization),
	);
	const supportingMetadataText = joinSearchValues([
		food.alternateDescription,
		food.scientificName,
		food.preparation,
		food.marketCountry,
		food.packageWeight,
		food.ingredients,
		...(food.ingredientList ?? []),
		...(food.additives ?? []),
		...(food.allergens ?? []),
		...(food.traces ?? []),
		...(food.dietaryTags ?? []),
		...(food.labels ?? []),
		...(food.safetyAlerts ?? []).flatMap((alert) => [
			alert.productDescription,
			alert.reason,
		]),
	]);

	return [
		{ priority: 0, value: food.description },
		{ priority: 1, value: food.brandOwner ?? "" },
		{ priority: 2, value: organizationText },
		{ priority: 3, value: categoryText },
		{
			priority: 4,
			value: joinSearchValues([
				food.description,
				food.brandOwner,
				organizationText,
				categoryText,
				supportingMetadataText,
			]),
		},
		{ priority: 5, value: supportingMetadataText },
	].filter((field) => field.value.length > 0);
};

const getFoodSearchRelevance = (
	food: FoodItem,
	searchWords: string[],
): SearchRelevance => {
	const fieldMatches = getSearchableFoodFields(food)
		.map((field) => ({
			fieldPriority: field.priority,
			...getSearchRelevance(field.value, searchWords),
		}))
		.filter((match) => match.tier < 6)
		.sort(compareSearchRelevance);

	return fieldMatches[0] ?? {
		fieldPriority: Number.MAX_SAFE_INTEGER,
		tier: 6,
		firstMatchPosition: Number.MAX_SAFE_INTEGER,
		lastMatchPosition: Number.MAX_SAFE_INTEGER,
		fieldWordCount: Number.MAX_SAFE_INTEGER,
	};
};

const compareSearchRelevance = (
	left: SearchRelevance,
	right: SearchRelevance,
) =>
	left.fieldPriority - right.fieldPriority ||
	left.tier - right.tier ||
	left.firstMatchPosition - right.firstMatchPosition ||
	left.lastMatchPosition - right.lastMatchPosition ||
	left.fieldWordCount - right.fieldWordCount;

export const createIngredientSearchRelevanceComparator = (query: string) => {
	const searchWords = tokenizeIngredientSearchText(query);
	const relevanceCache = new WeakMap<FoodItem, SearchRelevance>();
	const readRelevance = (food: FoodItem) => {
		const cached = relevanceCache.get(food);
		if (cached) return cached;
		const relevance = getFoodSearchRelevance(food, searchWords);
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
