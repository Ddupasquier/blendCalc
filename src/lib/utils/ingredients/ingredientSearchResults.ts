import type { FdcFood } from "$lib/utils/food/types";
import { compareFoodQuality } from "$lib/utils/food/quality/foodQuality";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import { getFoodDownrankScore } from "$lib/utils/profile/foodPreferenceWarnings";

export const mergeIngredientSearchResults = (...resultGroups: FdcFood[][]) => {
	const seen = new Set<number>();
	const seenBarcodes = new Set<string>();

	return resultGroups.flat().filter((food) => {
		if (seen.has(food.fdcId)) return false;
		const barcode = food.barcode ?? food.gtinUpc;
		if (barcode && seenBarcodes.has(barcode)) return false;
		seen.add(food.fdcId);
		if (barcode) seenBarcodes.add(barcode);
		return true;
	});
};

const sortByQualityThenName = (
	items: FdcFood[],
	preferenceProfile: FoodPreferenceProfile | null,
) =>
	items.sort((a, b) => {
		const preferencePenalty =
			getFoodDownrankScore(a, preferenceProfile) -
			getFoodDownrankScore(b, preferenceProfile);
		if (preferencePenalty !== 0) return preferencePenalty;
		const qualitySort = compareFoodQuality(a, b);
		if (qualitySort !== 0) return qualitySort;
		return a.description.localeCompare(b.description);
	});

export const sortIngredientSearchResults = (
	results: FdcFood[],
	query: string,
	preferenceProfile: FoodPreferenceProfile | null,
) => {
	const allTerms = query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);

	if (allTerms.length === 0) {
		return sortByQualityThenName([...results], preferenceProfile);
	}

	if (allTerms.length === 1) {
		const startsWith: FdcFood[] = [];
		const contains: FdcFood[] = [];
		const rest: FdcFood[] = [];

		for (const food of results) {
			const description = food.description.toLowerCase();
			if (description.startsWith(allTerms[0])) {
				startsWith.push(food);
			} else if (description.includes(allTerms[0])) {
				contains.push(food);
			} else {
				rest.push(food);
			}
		}

		sortByQualityThenName(startsWith, preferenceProfile);
		sortByQualityThenName(contains, preferenceProfile);
		sortByQualityThenName(rest, preferenceProfile);
		return [...startsWith, ...contains, ...rest];
	}

	const allParts: FdcFood[] = [];
	const firstPart: FdcFood[] = [];
	const rest: FdcFood[] = [];

	for (const food of results) {
		const description = food.description.toLowerCase();
		const containsAll = allTerms.every((term) => description.includes(term));
		if (containsAll) {
			if (description.startsWith(allTerms[0])) {
				firstPart.push(food);
			} else {
				allParts.push(food);
			}
		} else {
			rest.push(food);
		}
	}

	sortByQualityThenName(firstPart, preferenceProfile);
	sortByQualityThenName(allParts, preferenceProfile);
	sortByQualityThenName(rest, preferenceProfile);
	return [...firstPart, ...allParts, ...rest];
};
