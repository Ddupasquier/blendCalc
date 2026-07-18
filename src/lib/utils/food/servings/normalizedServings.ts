import { compactFood } from "$lib/utils/food/records/foodRecords";
import type { FdcFood, FoodServing } from "$lib/utils/food/types";

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
			const gramWeight = Number(row.gramWeight);
			const amount = Number(row.amount);
			if (!label || !Number.isFinite(gramWeight) || gramWeight <= 0) return [];
			return [{
				label,
				gramWeight,
				amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
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
	rows: NormalizedServingRow[] | undefined,
): FdcFood => {
	const foodServings = normalizedRowsToServings(rows ?? []);
	if (foodServings.length === 0) return compactFood(food);
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
