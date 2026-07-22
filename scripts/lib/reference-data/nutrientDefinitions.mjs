const toNutrientId = (value) => {
	const nutrientId = Number(value);
	return Number.isFinite(nutrientId) ? nutrientId : null;
};

const normalizeNutrientNumber = (value) => String(value ?? "").trim() || null;

export const createNutrientDefinitionCatalog = (definitions) => {
	const definitionsById = new Map();
	const definitionsByNumber = new Map();

	const register = (definition) => {
		const nutrientId = toNutrientId(definition.nutrient_id);
		if (nutrientId === null) return null;

		const nutrientNumber = normalizeNutrientNumber(definition.nutrient_number);
		const existing = definitionsById.get(nutrientId) ??
			(nutrientNumber ? definitionsByNumber.get(nutrientNumber) : null);
		if (existing) return existing;

		const normalizedDefinition = {
			...definition,
			nutrient_id: nutrientId,
			nutrient_number: nutrientNumber,
		};
		definitionsById.set(nutrientId, normalizedDefinition);
		if (nutrientNumber) definitionsByNumber.set(nutrientNumber, normalizedDefinition);
		return normalizedDefinition;
	};

	for (const definition of definitions) register(definition);

	return {
		get(nutrientId) {
			return definitionsById.get(toNutrientId(nutrientId));
		},
		register,
		resolve(nutrientId, nutrientNumber) {
			return definitionsById.get(toNutrientId(nutrientId)) ??
				definitionsByNumber.get(normalizeNutrientNumber(nutrientNumber));
		},
		values() {
			return definitionsById.values();
		},
	};
};
