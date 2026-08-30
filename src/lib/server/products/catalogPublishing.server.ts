import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeSourceManagedFoodForStorage } from "$lib/utils/food/records/foodRecords";
import type { FoodItem } from "$lib/utils/food/types";
import { toJson } from "$lib/utils/storage/supabase/shared";
import type {
	CatalogConflict,
	CatalogFieldProvenance,
	CatalogObservation,
} from "./catalogVerification.server";
import { assertSharedProductFoodCanBePublished } from "./catalogFoodValidation.server";

type CatalogSource = "usda" | "open-food-facts" | "community-reviewed";
type CatalogConfidence =
	"source-verified" | "moderator-reviewed" | "corroborated" | "imported";

export const publishCatalogSubmission = async (input: {
	submissionId: string;
	food: FoodItem;
	productName: string;
	brandOwner?: string;
	source: CatalogSource;
	sourceReference?: string;
	confidence: CatalogConfidence;
	approvedBy?: string;
	observations: CatalogObservation[];
	provenance: CatalogFieldProvenance[];
	conflicts: CatalogConflict[];
}) => {
	const admin = getSupabaseAdminClient();
	const normalizedFood = normalizeSourceManagedFoodForStorage({
		...input.food,
		description: input.productName,
	});
	await assertSharedProductFoodCanBePublished(admin, normalizedFood);
	const { data, error } = await admin.rpc("publish_shared_product_submission", {
		p_submission_id: input.submissionId,
		p_food: toJson(normalizedFood),
		p_product_name: normalizedFood.description,
		p_brand_owner: input.brandOwner ?? "",
		p_source: input.source,
		p_source_reference: input.sourceReference ?? "",
		p_confidence: input.confidence,
		p_observations: toJson(input.observations),
		p_provenance: toJson(input.provenance),
		p_conflicts: toJson(input.conflicts),
		...(input.approvedBy ? { p_approved_by: input.approvedBy } : {}),
	});
	if (error) throw error;
	return data;
};
