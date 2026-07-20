import { compactFood } from "$lib/utils/food/records/foodRecords";
import type { FdcFood, FoodServing } from "$lib/utils/food/types";
import { toFinitePositiveNumber } from "$lib/utils/numbers/finiteNumbers";

export type NormalizedServingRow = {
	servingOrder: number;
	label: string;
	gramWeight: number;
	amount: number | null;
	unitKey: string | null;
	isPrimary: boolean;
	source: NonNullable<FoodServing["source"]>;
	sourceReference: string | null;
	confidence: NonNullable<FoodServing["confidence"]>;
};

export const normalizedRowsToServings = (
	rows: NormalizedServingRow[],
): FoodServing[] =>
	rows
		.flatMap((row) => {
			const label = row.label.trim();
			const gramWeight = toFinitePositiveNumber(row.gramWeight);
			const amount = toFinitePositiveNumber(row.amount);
			if (!label || gramWeight === null) return [];
			return [{
				label,
				gramWeight,
				amount: amount ?? undefined,
				unitKey: row.unitKey?.trim() || undefined,
				isPrimary: row.isPrimary,
				source: row.source,
				sourceReference: row.sourceReference?.trim() || undefined,
				confidence: row.confidence,
			}];
		})
		.sort((left, right) =>
			Number(right.isPrimary) - Number(left.isPrimary) ||
			left.gramWeight - right.gramWeight ||
			left.label.localeCompare(right.label),
		);

export const hydrateFoodWithNormalizedServings = (
	food: FdcFood,
	rows: NormalizedServingRow[],
): FdcFood => {
	const foodServings = normalizedRowsToServings(rows);
	if (foodServings.length === 0) {
		return compactFood({
			...food,
			hasSourceServing: false,
			foodServings: [],
			servingSize: undefined,
			servingSizeUnit: undefined,
			householdServingFullText: undefined,
			customServingLabel: undefined,
			customServingWeightGrams: undefined,
			customDensityGramsPerMilliliter: undefined,
			customDensityLabel: undefined,
			customDensityVariancePercent: undefined,
			customDensityConfidence: undefined,
		});
	}
	const primaryServing = foodServings.find((serving) => serving.isPrimary) ?? foodServings[0];

	return compactFood({
		...food,
		hasSourceServing: true,
		foodServings,
		servingSize: primaryServing.gramWeight,
		servingSizeUnit: "g",
		householdServingFullText: primaryServing.label,
	});
};
