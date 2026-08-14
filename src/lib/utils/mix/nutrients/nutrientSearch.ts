import type { NutrientMeta } from "$lib/utils/mix/calculations";

const normalizeNutrientSearchText = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");

const compactNutrientSearchText = (value: string) => value.replace(/\s+/g, "");

export const searchNutrientCatalog = (
	nutrients: NutrientMeta[],
	query: string,
	limit = 24,
) => {
	const normalizedQuery = normalizeNutrientSearchText(query);
	if (!normalizedQuery) return [];
	const compactQuery = compactNutrientSearchText(normalizedQuery);

	return nutrients
		.map((nutrient) => {
			const label = normalizeNutrientSearchText(nutrient.label ?? "");
			const compactLabel = compactNutrientSearchText(label);
			const unit = normalizeNutrientSearchText(nutrient.unit ?? "");
			const id = String(nutrient.id);
			const searchableText = `${label} ${unit} ${id}`;
			const compactSearchableText = compactNutrientSearchText(searchableText);
			const rank =
				label === normalizedQuery || compactLabel === compactQuery
					? 0
					: label.startsWith(normalizedQuery) ||
							compactLabel.startsWith(compactQuery)
						? 1
						: label.includes(normalizedQuery) ||
								compactLabel.includes(compactQuery)
							? 2
							: searchableText.includes(normalizedQuery) ||
									compactSearchableText.includes(compactQuery)
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
