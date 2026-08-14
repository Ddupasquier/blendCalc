import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type { ProductRegulatoryDisclosureProfile } from "$lib/utils/food/quality/nutritionCompletenessCatalog";

export const readProductRegulatoryDisclosureProfiles = async (
	supabase: SupabaseClient<Database> | null,
): Promise<ProductRegulatoryDisclosureProfile[]> => {
	if (!supabase) return [];
	const { data, error } = await supabase
		.from("product_regulatory_disclosure_profiles")
		.select(
			"key, display_name, user_description, disclosure_kind, nutrition_evaluation_mode, nutrition_profile_key, region_code, authority_name, requires_alcohol_by_volume, requires_moderator_review, user_selectable, source_reference, sort_order, is_default",
		)
		.eq("enabled", true)
		.order("sort_order", { ascending: true })
		.order("key", { ascending: true });
	if (error) throw error;

	return (data ?? []).map((row) => {
		if (
			!(["standard-nutrition", "regulated-alcohol", "permitted-sparse", "case-specific", "unknown"] as const)
				.includes(row.disclosure_kind as ProductRegulatoryDisclosureProfile["disclosureKind"]) ||
			!(["profile", "sparse-accepted", "case-specific", "unknown"] as const)
				.includes(row.nutrition_evaluation_mode as ProductRegulatoryDisclosureProfile["nutritionEvaluationMode"])
		) {
			throw new Error(`Unsupported regulatory disclosure profile ${row.key}.`);
		}

		return {
		key: row.key,
		displayName: row.display_name,
		userDescription: row.user_description,
		disclosureKind:
			row.disclosure_kind as ProductRegulatoryDisclosureProfile["disclosureKind"],
		nutritionEvaluationMode:
			row.nutrition_evaluation_mode as ProductRegulatoryDisclosureProfile["nutritionEvaluationMode"],
		nutritionProfileKey: row.nutrition_profile_key,
		regionCode: row.region_code,
		authorityName: row.authority_name,
		requiresAlcoholByVolume: row.requires_alcohol_by_volume,
		requiresModeratorReview: row.requires_moderator_review,
		userSelectable: row.user_selectable,
		sourceReference: row.source_reference,
		sortOrder: row.sort_order,
		isDefault: row.is_default,
		} satisfies ProductRegulatoryDisclosureProfile;
	});
};
