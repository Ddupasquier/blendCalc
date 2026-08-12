const normalizedNutrientUnitAliases = new Map([
	["GRAM", "G"],
	["GRAMS", "G"],
	["MILLIGRAM", "MG"],
	["MILLIGRAMS", "MG"],
	["MICROGRAM", "UG"],
	["MICROGRAMS", "UG"],
	["MCG", "UG"],
	["KILOCALORIE", "KCAL"],
	["KILOCALORIES", "KCAL"],
	["KILOJOULE", "KJ"],
	["KILOJOULES", "KJ"],
	["INTERNATIONAL UNIT", "IU"],
	["INTERNATIONAL UNITS", "IU"],
	["NIACIN EQUIVALENTS", "NE"],
]);

export const normalizeNutrientUnitName = (unit: unknown) => {
	const normalized = String(unit ?? "")
		.trim()
		.toUpperCase()
		.replaceAll("Μ", "U")
		.replaceAll("µ", "U");
	return normalizedNutrientUnitAliases.get(normalized) ?? normalized;
};
