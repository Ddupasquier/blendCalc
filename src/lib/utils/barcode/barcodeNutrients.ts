import type { FdcNutrient } from "$lib/utils/food/types";

type OpenFoodFactsNutriments = Record<string, number | string | undefined>;

type OpenFoodFactsNutrientDefinition = {
	keys: string[];
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string;
	unitName: string;
};

const OPEN_FOOD_FACTS_NUTRIENTS: OpenFoodFactsNutrientDefinition[] = [
	{ keys: ["saturated-fat"], nutrientId: 1258, nutrientName: "Fatty acids, total saturated", nutrientNumber: "606", unitName: "G" },
	{ keys: ["trans-fat"], nutrientId: 1257, nutrientName: "Fatty acids, total trans", nutrientNumber: "605", unitName: "G" },
	{ keys: ["monounsaturated-fat"], nutrientId: 1292, nutrientName: "Fatty acids, total monounsaturated", nutrientNumber: "645", unitName: "G" },
	{ keys: ["polyunsaturated-fat"], nutrientId: 1293, nutrientName: "Fatty acids, total polyunsaturated", nutrientNumber: "646", unitName: "G" },
	{ keys: ["cholesterol"], nutrientId: 1253, nutrientName: "Cholesterol", nutrientNumber: "601", unitName: "MG" },
	{ keys: ["sodium"], nutrientId: 1093, nutrientName: "Sodium, Na", nutrientNumber: "307", unitName: "MG" },
	{ keys: ["potassium"], nutrientId: 1092, nutrientName: "Potassium, K", nutrientNumber: "306", unitName: "MG" },
	{ keys: ["calcium"], nutrientId: 1087, nutrientName: "Calcium, Ca", nutrientNumber: "301", unitName: "MG" },
	{ keys: ["iron"], nutrientId: 1089, nutrientName: "Iron, Fe", nutrientNumber: "303", unitName: "MG" },
	{ keys: ["magnesium"], nutrientId: 1090, nutrientName: "Magnesium, Mg", nutrientNumber: "304", unitName: "MG" },
	{ keys: ["phosphorus"], nutrientId: 1091, nutrientName: "Phosphorus, P", nutrientNumber: "305", unitName: "MG" },
	{ keys: ["zinc"], nutrientId: 1095, nutrientName: "Zinc, Zn", nutrientNumber: "309", unitName: "MG" },
	{ keys: ["copper"], nutrientId: 1098, nutrientName: "Copper, Cu", nutrientNumber: "312", unitName: "MG" },
	{ keys: ["manganese"], nutrientId: 1101, nutrientName: "Manganese, Mn", nutrientNumber: "315", unitName: "MG" },
	{ keys: ["selenium"], nutrientId: 1103, nutrientName: "Selenium, Se", nutrientNumber: "317", unitName: "UG" },
	{ keys: ["vitamin-a"], nutrientId: 1106, nutrientName: "Vitamin A, RAE", nutrientNumber: "320", unitName: "UG" },
	{ keys: ["vitamin-c"], nutrientId: 1162, nutrientName: "Vitamin C, total ascorbic acid", nutrientNumber: "401", unitName: "MG" },
	{ keys: ["vitamin-d"], nutrientId: 1114, nutrientName: "Vitamin D (D2 + D3)", nutrientNumber: "328", unitName: "UG" },
	{ keys: ["vitamin-e"], nutrientId: 1109, nutrientName: "Vitamin E (alpha-tocopherol)", nutrientNumber: "323", unitName: "MG" },
	{ keys: ["vitamin-k"], nutrientId: 1185, nutrientName: "Vitamin K (phylloquinone)", nutrientNumber: "430", unitName: "UG" },
	{ keys: ["vitamin-b1", "thiamin"], nutrientId: 1165, nutrientName: "Thiamin", nutrientNumber: "404", unitName: "MG" },
	{ keys: ["vitamin-b2", "riboflavin"], nutrientId: 1166, nutrientName: "Riboflavin", nutrientNumber: "405", unitName: "MG" },
	{ keys: ["vitamin-pp", "niacin"], nutrientId: 1167, nutrientName: "Niacin", nutrientNumber: "406", unitName: "MG" },
	{ keys: ["vitamin-b6"], nutrientId: 1175, nutrientName: "Vitamin B-6", nutrientNumber: "415", unitName: "MG" },
	{ keys: ["vitamin-b9", "folates", "folate"], nutrientId: 1177, nutrientName: "Folate, total", nutrientNumber: "417", unitName: "UG" },
	{ keys: ["vitamin-b12"], nutrientId: 1178, nutrientName: "Vitamin B-12", nutrientNumber: "418", unitName: "UG" },
	{ keys: ["pantothenic-acid"], nutrientId: 1170, nutrientName: "Pantothenic acid", nutrientNumber: "410", unitName: "MG" },
	{ keys: ["biotin"], nutrientId: 1176, nutrientName: "Biotin", nutrientNumber: "416", unitName: "UG" },
	{ keys: ["choline"], nutrientId: 1180, nutrientName: "Choline, total", nutrientNumber: "421", unitName: "MG" },
	{ keys: ["iodine"], nutrientId: 1100, nutrientName: "Iodine, I", nutrientNumber: "314", unitName: "UG" },
	{ keys: ["molybdenum"], nutrientId: 1102, nutrientName: "Molybdenum, Mo", nutrientNumber: "316", unitName: "UG" },
	{ keys: ["fluoride"], nutrientId: 1099, nutrientName: "Fluoride, F", nutrientNumber: "313", unitName: "UG" },
	{ keys: ["starch"], nutrientId: 1009, nutrientName: "Starch", nutrientNumber: "209", unitName: "G" },
	{ keys: ["alcohol"], nutrientId: 1018, nutrientName: "Alcohol, ethyl", nutrientNumber: "221", unitName: "G" },
	{ keys: ["caffeine"], nutrientId: 1057, nutrientName: "Caffeine", nutrientNumber: "262", unitName: "MG" },
	{ keys: ["added-sugars"], nutrientId: 1235, nutrientName: "Sugars, added", nutrientNumber: "539", unitName: "G" },
];

const normalizeUnit = (unit: unknown) =>
	String(unit ?? "")
		.trim()
		.toUpperCase()
		.replace("Μ", "U")
		.replace("µ", "U")
		.replace("MCG", "UG");

const toOptionalNumber = (value: unknown) => {
	if (value === undefined || value === null || value === "") return null;
	const numberValue = typeof value === "string" ? Number.parseFloat(value) : Number(value);
	return Number.isFinite(numberValue) ? Math.max(0, numberValue) : null;
};

const convertMassUnit = (value: number, sourceUnit: string, targetUnit: string) => {
	const source = normalizeUnit(sourceUnit || targetUnit);
	const target = normalizeUnit(targetUnit);
	if (source === target) return value;

	const milligramsPerUnit: Record<string, number> = {
		G: 1000,
		MG: 1,
		UG: 0.001,
	};
	const sourceFactor = milligramsPerUnit[source];
	const targetFactor = milligramsPerUnit[target];
	if (!sourceFactor || !targetFactor) return null;
	return (value * sourceFactor) / targetFactor;
};

export const getOpenFoodFactsValue = (
	nutriments: OpenFoodFactsNutriments,
	keys: string[],
	servingWeightGrams: number,
	useServingValues: boolean,
) => {
	for (const key of keys) {
		const servingValue = toOptionalNumber(nutriments[`${key}_serving`]);
		if (useServingValues && servingValue !== null) {
			return { key, value: servingValue };
		}

		const per100GramValue = toOptionalNumber(nutriments[`${key}_100g`]);
		if (per100GramValue !== null) {
			return {
				key,
				value: (per100GramValue * servingWeightGrams) / 100,
			};
		}
	}

	return null;
};

export const mapOpenFoodFactsAdditionalNutrients = (
	nutriments: OpenFoodFactsNutriments,
	servingWeightGrams: number,
	useServingValues: boolean,
): FdcNutrient[] => {
	return OPEN_FOOD_FACTS_NUTRIENTS.flatMap((definition) => {
		const source = getOpenFoodFactsValue(
			nutriments,
			definition.keys,
			servingWeightGrams,
			useServingValues,
		);
		if (!source) return [];

		const sourceUnit = String(
			nutriments[`${source.key}_unit`] ?? definition.unitName,
		);
		const convertedValue =
			definition.nutrientId === 1114 && normalizeUnit(sourceUnit) === "IU"
				? source.value / 40
				: convertMassUnit(source.value, sourceUnit, definition.unitName);
		if (convertedValue === null) return [];

		return [{
			nutrientId: definition.nutrientId,
			nutrientName: definition.nutrientName,
			nutrientNumber: definition.nutrientNumber,
			unitName: definition.unitName,
			value: convertedValue,
		}];
	});
};
