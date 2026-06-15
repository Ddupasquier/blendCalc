import { compactFood } from "$lib/utils/food/foodRecords";
import type { FdcFood, FdcNutrient } from "$lib/utils/food/types";

export type NormalizedNutrientRow = {
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string | null;
	unitName: string;
	value: number;
	valueOrigin: NonNullable<FdcNutrient["valueOrigin"]>;
	source: NonNullable<FdcNutrient["source"]>;
	sourceReference: string | null;
	confidence: NonNullable<FdcNutrient["confidence"]>;
};

const toFiniteNonnegativeNumber = (value: number) => {
	return Number.isFinite(value) && value >= 0 ? value : null;
};

export const normalizedRowsToNutrients = (
	rows: NormalizedNutrientRow[],
): FdcNutrient[] => {
	const nutrients = new Map<number, FdcNutrient>();

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
		});
	}

	return [...nutrients.values()];
};

export const hydrateFoodWithNormalizedNutrients = (
	food: FdcFood,
	rows: NormalizedNutrientRow[] | undefined,
): FdcFood => {
	const normalizedNutrients = normalizedRowsToNutrients(rows ?? []);
	if (normalizedNutrients.length === 0) return compactFood(food);

	return compactFood({
		...food,
		foodNutrients: normalizedNutrients,
		reportedNutrientIds: normalizedNutrients
			.filter((nutrient) => nutrient.valueOrigin === "reported")
			.map((nutrient) => nutrient.nutrientId),
	});
};
