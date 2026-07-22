import type { FoodQuality } from "$lib/utils/food/quality/foodQuality";

export type NutritionConfidenceDetailsProps = {
	quality: FoodQuality;
	compact?: boolean;
};
