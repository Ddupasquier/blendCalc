import type { FoodCompatibilityMatchRule } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import type { FdcFood } from "$lib/utils/food/types";

const getRuleFieldValue = (food: FdcFood) => food.ingredients ?? "";

const matchesPattern = (value: string, pattern: string) => {
	try {
		return new RegExp(pattern, "i").exec(value);
	} catch {
		return null;
	}
};

export const getRuleDerivedCompatibilityFacts = (
	food: FdcFood,
	rules: FoodCompatibilityMatchRule[],
): FoodCompatibilityFact[] =>
	[...rules]
		.sort((left, right) => left.priority - right.priority)
		.flatMap((rule) => {
			if (rule.sourceKey && rule.sourceKey !== food.sourceKey) return [];
			const runtimeRule = rule as unknown as {
				fieldName?: unknown;
				sourceType?: unknown;
			};
			if (
				runtimeRule.fieldName !== "ingredients" ||
				runtimeRule.sourceType !== "label_ingredient_field"
			) return [];
			const sourceValue = getRuleFieldValue(food);
			if (!sourceValue) return [];

			const match = matchesPattern(sourceValue, rule.matchPattern);
			if (
				!match ||
				(rule.excludePattern &&
					matchesPattern(sourceValue, rule.excludePattern))
			) return [];
				return [{
					slug: rule.tagSlug,
					label: rule.tagLabel,
					category: rule.tagCategory,
					factType: rule.factType,
					sourceType: rule.sourceType,
					sourceText: match[0],
					confidence: rule.confidence,
				}];
			});
