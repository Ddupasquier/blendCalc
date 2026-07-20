const normalizeKey = (value) =>
	String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/_100g$/i, "")
		.replace(/_/g, "-");

const normalizeUnit = (value) =>
	String(value ?? "")
		.trim()
		.toUpperCase()
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U")
		.replace("MCG", "UG");

const compareMappings = (left, right) =>
	Number(left.priority ?? 1000) - Number(right.priority ?? 1000) ||
	Number(right.confidence ?? 0) - Number(left.confidence ?? 0);

export const createSourceNutrientMappingCatalog = (mappings) => {
	const mappingsByKey = new Map();

	for (const mapping of mappings.filter((candidate) => candidate.enabled)) {
		const sourceKey = normalizeKey(mapping.source_nutrient_key);
		if (!sourceKey) continue;
		const candidates = mappingsByKey.get(sourceKey) ?? [];
		candidates.push(mapping);
		candidates.sort(compareMappings);
		mappingsByKey.set(sourceKey, candidates);
	}

	return {
		resolve({ sourceNutrientKey, sourceUnitName }) {
			const candidates = mappingsByKey.get(normalizeKey(sourceNutrientKey)) ?? [];
			if (candidates.length === 0) return null;

			const sourceUnit = normalizeUnit(sourceUnitName);
			const exactUnit = candidates.find(
				(candidate) => normalizeUnit(candidate.source_unit_name) === sourceUnit,
			);
			if (exactUnit) return exactUnit;

			const nutrientIds = new Set(candidates.map((candidate) => candidate.nutrient_id));
			return nutrientIds.size === 1 ? candidates[0] : null;
		},
	};
};
