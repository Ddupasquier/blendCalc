/**
 * Purpose: Normalize source nutrient records and provide deterministic checks for
 * exact-barcode nutrient basis, serving math, source agreement, and catalog storage.
 * This is a shared module. Do not run directly; it is imported by barcode audit tests
 * and the executable catalog audit workflow.
 */

const MICROGRAM_ALIASES = new Set(["MCG", "ΜG", "µG"]);

export const normalizeAuditUnit = (value) => {
	const normalized = String(value ?? "").trim().toUpperCase();
	return MICROGRAM_ALIASES.has(normalized) ? "UG" : normalized;
};

export const toAuditNumber = (value) => {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : null;
};

export const getRelativeDifference = (left, right) => {
	const leftNumber = Number(left);
	const rightNumber = Number(right);
	const largestMagnitude = Math.max(
		Math.abs(leftNumber),
		Math.abs(rightNumber),
	);
	if (largestMagnitude === 0) return 0;
	return Math.abs(leftNumber - rightNumber) / largestMagnitude;
};

export const valuesAgree = (
	left,
	right,
	{ absoluteTolerance = 0.0001, relativeTolerance = 0.000001 } = {},
) => {
	const leftNumber = Number(left);
	const rightNumber = Number(right);
	if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
		return false;
	}
	return Math.abs(leftNumber - rightNumber) <= absoluteTolerance ||
		getRelativeDifference(leftNumber, rightNumber) <= relativeTolerance;
};

export const createNutrientKey = (nutrientId, unitName) =>
	`${Number(nutrientId)}:${normalizeAuditUnit(unitName)}`;

const normalizeUsdaNutrient = (entry) => {
	const definition = entry?.nutrient ?? entry;
	const nutrientId = Number(definition?.id ?? entry?.nutrientId);
	const amount = toAuditNumber(entry?.amount ?? entry?.value);
	const unitName = normalizeAuditUnit(
		definition?.unitName ?? entry?.unitName,
	);
	if (
		!Number.isSafeInteger(nutrientId) ||
		nutrientId <= 0 ||
		amount === null ||
		!unitName
	) {
		return null;
	}
	return {
		nutrientId,
		nutrientName: String(
			definition?.name ?? entry?.nutrientName ?? nutrientId,
		).trim(),
		nutrientNumber: String(
			definition?.number ?? entry?.nutrientNumber ?? "",
		),
		unitName,
		value: amount,
	};
};

export const normalizeUsdaNutrients = (food) =>
	(food?.foodNutrients ?? []).flatMap((entry) => {
		const nutrient = normalizeUsdaNutrient(entry);
		return nutrient ? [nutrient] : [];
	});

const getEquivalenceBySourceId = (referenceData) =>
	new Map(
		(referenceData?.equivalences ?? [])
			.filter((entry) =>
				entry.source_key === "usda" &&
				Number.isSafeInteger(Number(entry.source_nutrient_id)),
			)
			.map((entry) => [Number(entry.source_nutrient_id), entry]),
	);

const getDefinitionById = (referenceData) =>
	new Map(
		(referenceData?.definitions ?? []).map((definition) => [
			Number(definition.nutrient_id),
			definition,
		]),
	);

export const canonicalizeUsdaNutrients = (food, referenceData) => {
	const nutrients = normalizeUsdaNutrients(food);
	const equivalenceBySourceId = getEquivalenceBySourceId(referenceData);
	const definitionById = getDefinitionById(referenceData);
	const canonicalTargetIds = new Set(
		[...equivalenceBySourceId.values()].map((entry) =>
			Number(entry.canonical_nutrient_id)
		),
	);
	const exactCanonicalIds = new Set(
		nutrients
			.map((nutrient) => nutrient.nutrientId)
			.filter((nutrientId) => canonicalTargetIds.has(nutrientId)),
	);
	const emittedIds = new Set();
	const canonicalNutrients = [];

	for (const nutrient of nutrients) {
		const equivalence = equivalenceBySourceId.get(nutrient.nutrientId);
		const canonicalId = Number(
			equivalence?.canonical_nutrient_id ?? nutrient.nutrientId,
		);
		const isAlias = canonicalId !== nutrient.nutrientId;
		if (
			(isAlias && exactCanonicalIds.has(canonicalId)) ||
			emittedIds.has(canonicalId)
		) {
			continue;
		}

		const definition = definitionById.get(canonicalId);
		if (
			isAlias &&
			definition &&
			normalizeAuditUnit(definition.default_unit_name) !== nutrient.unitName
		) {
			if (!emittedIds.has(nutrient.nutrientId)) {
				emittedIds.add(nutrient.nutrientId);
				canonicalNutrients.push(nutrient);
			}
			continue;
		}

		emittedIds.add(canonicalId);
		canonicalNutrients.push({
			...nutrient,
			nutrientId: canonicalId,
			nutrientName:
				definition?.nutrient_name ?? nutrient.nutrientName,
			nutrientNumber:
				definition?.nutrient_number ?? nutrient.nutrientNumber,
			unitName: normalizeAuditUnit(
				definition?.default_unit_name ?? nutrient.unitName,
			),
		});
	}

	return canonicalNutrients;
};

export const createNutrientMap = (nutrients) => {
	const nutrientMap = new Map();
	const duplicates = [];
	for (const nutrient of nutrients ?? []) {
		const nutrientId = Number(
			nutrient.nutrientId ?? nutrient.nutrient_id,
		);
		const unitName = normalizeAuditUnit(
			nutrient.unitName ?? nutrient.unit_name,
		);
		const value = toAuditNumber(
			nutrient.value ?? nutrient.amount_per_100g,
		);
		if (
			!Number.isSafeInteger(nutrientId) ||
			nutrientId <= 0 ||
			!unitName ||
			value === null
		) {
			continue;
		}
		const key = createNutrientKey(nutrientId, unitName);
		if (nutrientMap.has(key)) duplicates.push(key);
		else {
			nutrientMap.set(key, {
				...nutrient,
				nutrientId,
				unitName,
				value,
			});
		}
	}
	return { nutrientMap, duplicates };
};

export const compareNutrientMaps = ({
	expected,
	actual,
	absoluteTolerance = 0.02,
	relativeTolerance = 0.005,
}) => {
	const missing = [];
	const unexpected = [];
	const mismatched = [];

	for (const [key, expectedNutrient] of expected) {
		const actualNutrient = actual.get(key);
		if (!actualNutrient) {
			missing.push(key);
			continue;
		}
		if (!valuesAgree(expectedNutrient.value, actualNutrient.value, {
			absoluteTolerance,
			relativeTolerance,
		})) {
			mismatched.push({
				key,
				expected: expectedNutrient.value,
				actual: actualNutrient.value,
				relativeDifference: getRelativeDifference(
					expectedNutrient.value,
					actualNutrient.value,
				),
			});
		}
	}

	for (const key of actual.keys()) {
		if (!expected.has(key)) unexpected.push(key);
	}

	return { missing, unexpected, mismatched };
};

export const auditPer100ServingRoundTrip = (
	nutrients,
	servingWeightGrams,
) => {
	const servingWeight = Number(servingWeightGrams);
	if (!Number.isFinite(servingWeight) || servingWeight <= 0) {
		return {
			checked: 0,
			mismatched: [],
			reason: "missing-serving-weight",
		};
	}

	const mismatched = [];
	for (const nutrient of nutrients ?? []) {
		const per100Value = toAuditNumber(nutrient.value);
		if (per100Value === null) continue;
		const perServingValue = per100Value * servingWeight / 100;
		const roundTripValue = perServingValue * 100 / servingWeight;
		if (!valuesAgree(per100Value, roundTripValue)) {
			mismatched.push({
				nutrientId: nutrient.nutrientId,
				per100Value,
				perServingValue,
				roundTripValue,
			});
		}
	}
	return {
		checked: (nutrients ?? []).length,
		mismatched,
		reason: null,
	};
};

const USDA_LABEL_NUTRIENTS = {
	calories: { nutrientId: 1008, unitName: "KCAL", absoluteTolerance: 5 },
	fat: { nutrientId: 1004, unitName: "G", absoluteTolerance: 0.5 },
	saturatedFat: {
		nutrientId: 1258,
		unitName: "G",
		absoluteTolerance: 0.5,
	},
	transFat: {
		nutrientId: 1257,
		unitName: "G",
		absoluteTolerance: 0.5,
	},
	cholesterol: {
		nutrientId: 1253,
		unitName: "MG",
		absoluteTolerance: 5,
	},
	sodium: { nutrientId: 1093, unitName: "MG", absoluteTolerance: 5 },
	carbohydrates: {
		nutrientId: 1005,
		unitName: "G",
		absoluteTolerance: 0.5,
	},
	fiber: { nutrientId: 1079, unitName: "G", absoluteTolerance: 0.5 },
	sugars: { nutrientId: 2000, unitName: "G", absoluteTolerance: 0.5 },
	addedSugar: {
		nutrientId: 1235,
		unitName: "G",
		absoluteTolerance: 0.5,
	},
	protein: { nutrientId: 1003, unitName: "G", absoluteTolerance: 0.5 },
	calcium: { nutrientId: 1087, unitName: "MG", absoluteTolerance: 5 },
	iron: { nutrientId: 1089, unitName: "MG", absoluteTolerance: 0.5 },
	potassium: { nutrientId: 1092, unitName: "MG", absoluteTolerance: 5 },
	vitaminD: { nutrientId: 1114, unitName: "UG", absoluteTolerance: 0.5 },
};

export const getSourceServingWeightGrams = (food) => {
	const servingSize = Number(food?.servingSize);
	const servingUnit = normalizeAuditUnit(food?.servingSizeUnit);
	if (
		Number.isFinite(servingSize) &&
		servingSize > 0 &&
		["G", "GRM", "GRAM", "GRAMS"].includes(servingUnit)
	) {
		return servingSize;
	}
	return null;
};

export const auditUsdaLabelConsistency = (
	food,
	canonicalNutrientMap,
) => {
	const servingWeightGrams = getSourceServingWeightGrams(food);
	if (!food?.labelNutrients || servingWeightGrams === null) {
		return {
			checked: 0,
			missingPer100: [],
			mismatched: [],
			reason: servingWeightGrams === null
				? "missing-serving-weight"
				: "missing-label-nutrients",
		};
	}

	const missingPer100 = [];
	const mismatched = [];
	let checked = 0;
	for (const [labelKey, definition] of Object.entries(
		USDA_LABEL_NUTRIENTS,
	)) {
		const labelValue = toAuditNumber(
			food.labelNutrients[labelKey]?.value,
		);
		if (labelValue === null) continue;
		const nutrientKey = createNutrientKey(
			definition.nutrientId,
			definition.unitName,
		);
		const per100Nutrient = canonicalNutrientMap.get(nutrientKey);
		if (!per100Nutrient) {
			missingPer100.push({ labelKey, nutrientKey, labelValue });
			continue;
		}
		checked += 1;
		const calculatedServingValue =
			per100Nutrient.value * servingWeightGrams / 100;
		if (!valuesAgree(labelValue, calculatedServingValue, {
			absoluteTolerance: definition.absoluteTolerance,
			relativeTolerance: 0.02,
		})) {
			mismatched.push({
				labelKey,
				nutrientKey,
				labelValue,
				calculatedServingValue,
				servingWeightGrams,
			});
		}
	}

	return { checked, missingPer100, mismatched, reason: null };
};

const RELATIONSHIP_CHECKS = [
	{ child: 1258, parent: 1004, label: "saturated-fat-total-fat" },
	{ child: 1257, parent: 1004, label: "trans-fat-total-fat" },
	{ child: 1292, parent: 1004, label: "monounsaturated-fat-total-fat" },
	{ child: 1293, parent: 1004, label: "polyunsaturated-fat-total-fat" },
	{ child: 1079, parent: 1005, label: "fiber-carbohydrate" },
	{ child: 2000, parent: 1005, label: "sugars-carbohydrate" },
	{ child: 1235, parent: 2000, label: "added-sugars-total-sugars" },
];

const findNutrientById = (nutrientMap, nutrientId) =>
	[...nutrientMap.values()].find((nutrient) =>
		nutrient.nutrientId === nutrientId
	);

export const auditNutrientRelationships = (
	nutrientMap,
	tolerance = 0.5,
) => RELATIONSHIP_CHECKS.flatMap((relationship) => {
	const child = findNutrientById(nutrientMap, relationship.child);
	const parent = findNutrientById(nutrientMap, relationship.parent);
	if (!child || !parent || child.unitName !== parent.unitName) return [];
	return child.value > parent.value + tolerance
		? [{
				...relationship,
				childValue: child.value,
				parentValue: parent.value,
				unitName: child.unitName,
			}]
		: [];
});

export const getOpenFoodFactsServingWeightGrams = (product) => {
	const quantity = Number(product?.serving_quantity);
	const quantityUnit = normalizeAuditUnit(
		product?.serving_quantity_unit,
	);
	if (
		Number.isFinite(quantity) &&
		quantity > 0 &&
		["G", "GRM", "GRAM", "GRAMS"].includes(quantityUnit)
	) {
		return quantity;
	}
	const servingMatch = String(product?.serving_size ?? "").match(
		/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:g|grm|gram|grams)\b/iu,
	);
	if (!servingMatch) return null;
	const parsed = Number(servingMatch[1].replace(",", "."));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const convertOpenFoodFactsValue = ({
	value,
	sourceUnit,
	mapping,
	conversions,
}) => {
	const fromUnit = normalizeAuditUnit(
		sourceUnit || mapping.source_unit_name,
	);
	const toUnit = normalizeAuditUnit(mapping.default_unit_name);
	if (!fromUnit || fromUnit === toUnit) return value;
	const conversion = conversions.find((candidate) =>
		candidate.source_key === "open-food-facts" &&
		Number(candidate.nutrient_id) === Number(mapping.nutrient_id) &&
		normalizeAuditUnit(candidate.from_unit_name) === fromUnit &&
		normalizeAuditUnit(candidate.to_unit_name) === toUnit
	);
	return conversion ? value * Number(conversion.multiplier) : null;
};

export const mapOpenFoodFactsPer100Nutrients = (
	product,
	referenceData,
) => {
	const nutriments = product?.nutriments ?? {};
	const mappings = (referenceData?.mappings ?? [])
		.filter((mapping) =>
			mapping.source_key === "open-food-facts" &&
			mapping.enabled &&
			mapping.review_status === "approved",
		)
		.sort((left, right) => left.priority - right.priority);
	const emittedIds = new Set();
	const nutrients = [];

	for (const mapping of mappings) {
		const nutrientId = Number(mapping.nutrient_id);
		if (emittedIds.has(nutrientId)) continue;
		const sourceKey = mapping.source_nutrient_key;
		const sourceValue = toAuditNumber(
			nutriments[`${sourceKey}_100g`],
		);
		if (sourceValue === null) continue;
		const convertedValue = convertOpenFoodFactsValue({
			value: sourceValue,
			sourceUnit: nutriments[`${sourceKey}_unit`],
			mapping,
			conversions: referenceData?.conversions ?? [],
		});
		if (convertedValue === null) continue;
		emittedIds.add(nutrientId);
		nutrients.push({
			nutrientId,
			nutrientName: mapping.nutrient_name,
			nutrientNumber: mapping.nutrient_number,
			unitName: normalizeAuditUnit(mapping.default_unit_name),
			value: convertedValue,
			sourceNutrientKey: sourceKey,
		});
	}

	return nutrients;
};

export const auditOpenFoodFactsServingBasis = (
	product,
	referenceData,
) => {
	const servingWeightGrams = getOpenFoodFactsServingWeightGrams(product);
	if (servingWeightGrams === null) {
		return {
			checked: 0,
			mismatched: [],
			reason: "missing-serving-weight",
		};
	}
	const nutriments = product?.nutriments ?? {};
	const mappings = (referenceData?.mappings ?? [])
		.filter((mapping) =>
			mapping.source_key === "open-food-facts" &&
			mapping.enabled &&
			mapping.review_status === "approved",
		)
		.sort((left, right) => left.priority - right.priority);
	const checkedIds = new Set();
	const mismatched = [];
	let checked = 0;

	for (const mapping of mappings) {
		const nutrientId = Number(mapping.nutrient_id);
		if (checkedIds.has(nutrientId)) continue;
		const sourceKey = mapping.source_nutrient_key;
		const per100Value = toAuditNumber(
			nutriments[`${sourceKey}_100g`],
		);
		const servingValue = toAuditNumber(
			nutriments[`${sourceKey}_serving`],
		);
		if (per100Value === null || servingValue === null) continue;
		checkedIds.add(nutrientId);
		checked += 1;
		const calculatedServingValue =
			per100Value * servingWeightGrams / 100;
		if (!valuesAgree(servingValue, calculatedServingValue, {
			absoluteTolerance: 0.05,
			relativeTolerance: 0.02,
		})) {
			mismatched.push({
				nutrientId,
				sourceKey,
				per100Value,
				servingValue,
				calculatedServingValue,
				servingWeightGrams,
			});
		}
	}

	return { checked, mismatched, reason: null };
};

export const compareCrossSourceNutrients = (
	primaryMap,
	secondaryMap,
) => {
	const compared = [];
	const conflicts = [];
	for (const [key, primary] of primaryMap) {
		const secondary = secondaryMap.get(key);
		if (!secondary) continue;
		const comparison = {
			key,
			primary: primary.value,
			secondary: secondary.value,
			relativeDifference: getRelativeDifference(
				primary.value,
				secondary.value,
			),
		};
		compared.push(comparison);
		const absoluteTolerance = primary.unitName === "KCAL"
			? 10
			: primary.unitName === "G"
				? 1
				: 5;
		if (!valuesAgree(primary.value, secondary.value, {
			absoluteTolerance,
			relativeTolerance: 0.2,
		})) {
			conflicts.push(comparison);
		}
	}
	return { compared, conflicts };
};
