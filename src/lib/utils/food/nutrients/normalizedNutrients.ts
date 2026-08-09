import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import type { FoodItem, FoodNutrient } from "$lib/utils/food/types";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export type NormalizedNutrientRow = {
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string | null;
	unitName: string;
	value: number;
	valueOrigin: NonNullable<FoodNutrient["valueOrigin"]>;
	source: NonNullable<FoodNutrient["source"]>;
	sourceReference: string | null;
	confidence: NonNullable<FoodNutrient["confidence"]>;
	valueStatus: NonNullable<FoodNutrient["valueStatus"]>;
	valueQualifier: FoodNutrient["valueQualifier"] | null;
	standardError: number | null;
	sourceNutrientKey: string | null;
	sourceNutrientCode: string | null;
	mappingStatus: NonNullable<FoodNutrient["mappingStatus"]>;
	mappingMethod: string | null;
	mappingReviewReference: string | null;
	derivationMethod: string | null;
};

export const normalizedRowsToNutrients = (
	rows: NormalizedNutrientRow[],
): FoodNutrient[] => {
	const nutrients = new Map<number, FoodNutrient>();

	for (const row of rows) {
		const value = toFiniteNonnegativeNumber(row.value);
		const nutrientName = row.nutrientName.trim();
		const unitName = row.unitName.trim().toUpperCase();
		if (
			!Number.isSafeInteger(row.nutrientId) ||
			row.nutrientId <= 0 ||
			value === null ||
			!nutrientName ||
			!unitName ||
			nutrients.has(row.nutrientId)
		) {
			continue;
		}

		nutrients.set(row.nutrientId, {
			nutrientId: row.nutrientId,
			nutrientName,
			nutrientNumber: row.nutrientNumber?.trim() || String(row.nutrientId),
			unitName,
			value,
			valueOrigin: row.valueOrigin,
			source: row.source,
			sourceReference: row.sourceReference?.trim() || undefined,
			confidence: row.confidence,
			valueStatus: row.valueStatus,
			valueQualifier: row.valueQualifier ?? undefined,
			standardError:
				Number.isFinite(row.standardError) && Number(row.standardError) >= 0
					? Number(row.standardError)
					: undefined,
			sourceNutrientKey: row.sourceNutrientKey?.trim() || undefined,
			sourceNutrientCode: row.sourceNutrientCode?.trim() || undefined,
			mappingStatus: row.mappingStatus,
			mappingMethod: row.mappingMethod?.trim() || undefined,
			mappingReviewReference: row.mappingReviewReference?.trim() || undefined,
			derivationMethod: row.derivationMethod?.trim() || undefined,
		});
	}

	return [...nutrients.values()];
};

export const hydrateFoodWithNormalizedNutrients = (
	food: FoodItem,
	rows: NormalizedNutrientRow[],
): FoodItem => {
	const normalizedNutrients = normalizedRowsToNutrients(rows);

	return normalizeFoodForStorage({
		...food,
		foodNutrients: normalizedNutrients,
		reportedNutrientIds: normalizedNutrients
			.filter((nutrient) => nutrient.valueOrigin === "reported")
			.map((nutrient) => nutrient.nutrientId),
	});
};
