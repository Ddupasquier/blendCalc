import type { FdcFood } from "$lib/utils/food/types";
import { normalizePrivateCustomFoodFlag } from "$lib/utils/food/records/foodClassification";
import { isIngredientTrustStatus } from "./ingredientProvenance";

export type IngredientCatalogStateRow = {
	shared_product_id: string | null;
	shared_product_submission_id: string | null;
	source_key: string | null;
	trust_status: string | null;
};

export const hydrateFoodWithCatalogState = (
	food: FdcFood,
	state: IngredientCatalogStateRow,
): FdcFood =>
	normalizePrivateCustomFoodFlag({
		...food,
		sharedProductId: state.shared_product_id ?? undefined,
		sharedProductSubmissionId: state.shared_product_submission_id ?? undefined,
		sourceKey: state.source_key ?? food.sourceKey,
		trustStatus: isIngredientTrustStatus(state.trust_status)
			? state.trust_status
			: undefined,
	});
