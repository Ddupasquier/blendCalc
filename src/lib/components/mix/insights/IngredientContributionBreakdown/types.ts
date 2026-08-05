import type { NutrientContributionBreakdown } from "$lib/utils/mix/calculations";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type IngredientContributionBreakdownProps = MixSectionDisclosureProps & {
	breakdowns?: NutrientContributionBreakdown[];
};
