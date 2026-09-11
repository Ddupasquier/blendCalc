import type { CompatibleNutrientMappingCandidate } from "$lib/utils/moderation/nutrientMappingReview";

const normalizeSearchText = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");

export const searchCompatibleNutrients = (
	nutrients: readonly CompatibleNutrientMappingCandidate[],
	query: string,
) => {
	const normalizedQuery = normalizeSearchText(query);
	if (!normalizedQuery) return [...nutrients];

	const queryTerms = normalizedQuery.split(" ");
	return nutrients
		.map((nutrient) => {
			const name = normalizeSearchText(nutrient.nutrientName);
			const nutrientNumber = normalizeSearchText(nutrient.nutrientNumber ?? "");
			const nutrientId = String(nutrient.nutrientId);
			const unit = normalizeSearchText(nutrient.defaultUnitName);
			const searchableText = `${name} ${nutrientNumber} ${nutrientId} ${unit}`;
			const matches = queryTerms.every((term) => searchableText.includes(term));
			const rank =
				name === normalizedQuery ||
				nutrientNumber === normalizedQuery ||
				nutrientId === normalizedQuery
					? 0
					: name.startsWith(normalizedQuery)
						? 1
						: name.includes(normalizedQuery)
							? 2
							: 3;

			return { nutrient, matches, rank };
		})
		.filter(({ matches }) => matches)
		.sort(
			(first, second) =>
				first.rank - second.rank ||
				first.nutrient.nutrientName.localeCompare(
					second.nutrient.nutrientName,
				) ||
				first.nutrient.nutrientId - second.nutrient.nutrientId,
		)
		.map(({ nutrient }) => nutrient);
};
