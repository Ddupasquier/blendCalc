import type { NutrientMeta } from "$lib/utils/mix/calculations";

export const searchNutrientCatalog = (
	nutrients: NutrientMeta[],
	query: string,
	limit = 24,
) => {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return [];

	return nutrients
		.map((nutrient) => {
			const label = nutrient.label?.toLowerCase() ?? "";
			const unit = nutrient.unit?.toLowerCase() ?? "";
			const id = String(nutrient.id);
			const searchableText = `${label} ${unit} ${id}`;
			const rank = label === normalizedQuery
				? 0
				: label.startsWith(normalizedQuery)
					? 1
					: label.includes(normalizedQuery)
						? 2
						: searchableText.includes(normalizedQuery)
							? 3
							: 4;

			return { nutrient, rank };
		})
		.filter(({ rank }) => rank < 4)
		.sort(
			(first, second) =>
				first.rank - second.rank ||
				(first.nutrient.label ?? "").localeCompare(
					second.nutrient.label ?? "",
				),
		)
		.slice(0, limit)
		.map(({ nutrient }) => nutrient);
};
