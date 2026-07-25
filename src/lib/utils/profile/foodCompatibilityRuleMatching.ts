import type { FoodCompatibilityMatchRule } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import type { FdcFood } from "$lib/utils/food/types";

const getRuleFieldValue = (
	food: FdcFood,
	fieldName: FoodCompatibilityMatchRule["fieldName"],
) => {
	if (fieldName === "description") return food.description;
	if (fieldName === "food_category") return food.foodCategory ?? "";
	return food.ingredients ?? "";
};

export const getRuleDerivedCompatibilityFacts = (
	food: FdcFood,
	rules: FoodCompatibilityMatchRule[],
): FoodCompatibilityFact[] =>
	[...rules]
		.sort((left, right) => left.priority - right.priority)
		.flatMap((rule) => {
			if (rule.sourceKey && rule.sourceKey !== food.sourceKey) return [];
			const sourceValue = getRuleFieldValue(food, rule.fieldName);
			if (!sourceValue) return [];

			try {
				const match = new RegExp(rule.matchPattern, "i").exec(sourceValue);
				if (!match) return [];
				return [{
					slug: rule.tagSlug,
					label: rule.tagLabel,
					category: rule.tagCategory,
					factType: rule.factType,
					sourceType: rule.sourceType,
					sourceText: match[0],
					confidence: rule.confidence,
				}];
			} catch {
				return [];
			}
		});
