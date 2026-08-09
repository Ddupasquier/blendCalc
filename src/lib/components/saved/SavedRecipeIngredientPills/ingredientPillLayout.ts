import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
import type { FoodItem } from "$lib/utils/food/types";

export type IngredientPillSpan = 5 | 6 | 7 | 12;

export type PackedIngredientPill = {
	food: FoodItem;
	span: IngredientPillSpan;
};

type PackedRow = {
	items: PackedIngredientPill[];
	remaining: number;
};

const ROW_CAPACITY = 12;

const estimateLabelWidth = (label: string) =>
	Array.from(label.trim()).reduce((width, character) => {
		if (/[MW@%&]/.test(character)) return width + 1.35;
		if (/[il1.,'’:\s]/.test(character)) return width + 0.55;
		return width + 1;
	}, 0);

export const getIngredientPillSpan = (food: FoodItem): IngredientPillSpan => {
	const estimatedWidth =
		estimateLabelWidth(food.description) + (isPrivateCustomFood(food) ? 8 : 0);

	if (estimatedWidth <= 18) return 5;
	if (estimatedWidth <= 28) return 6;
	if (estimatedWidth <= 42) return 7;
	return 12;
};

export const packIngredientPills = (
	foods: FoodItem[],
): PackedIngredientPill[] => {
	const sizedFoods = foods
		.map((food, originalIndex) => ({
			food,
			originalIndex,
			span: getIngredientPillSpan(food),
		}))
		.sort(
			(left, right) =>
				right.span - left.span ||
				right.food.description.length - left.food.description.length ||
				left.originalIndex - right.originalIndex,
		);
	const rows: PackedRow[] = [];

	for (const { food, span } of sizedFoods) {
		let selectedRow: PackedRow | undefined;

		for (const row of rows) {
			if (row.remaining < span) continue;
			if (!selectedRow || row.remaining < selectedRow.remaining) {
				selectedRow = row;
			}
		}

		if (!selectedRow) {
			rows.push({
				items: [{ food, span }],
				remaining: ROW_CAPACITY - span,
			});
			continue;
		}

		selectedRow.items.push({ food, span });
		selectedRow.remaining -= span;
	}

	return rows.flatMap((row) => row.items);
};
