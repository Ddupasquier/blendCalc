import type { Database } from "$lib/types/database.types";
import type {
	FoodPreferenceResolution,
	FoodPreferenceResolutionMethod,
	FoodPreferenceResolutionStatus,
	FoodPreferenceRuleType,
} from "$lib/utils/profile/foodPreferenceProfile";
import type { SupabaseClient } from "@supabase/supabase-js";

type CompatibilityTag = Pick<
	Database["public"]["Tables"]["compatibility_tags"]["Row"],
	"id" | "slug" | "label" | "category"
>;

type ResolutionRow = Pick<
	Database["public"]["Tables"]["user_compatibility_rules"]["Row"],
	| "raw_value"
	| "normalized_value"
	| "rule_type"
	| "resolution_status"
	| "resolution_method"
	| "resolution_policy_version_id"
	| "resolution_language_code"
	| "ingredient_term_id"
	| "ingredient_alias_id"
	| "preference_term_mapping_id"
> & { tag: CompatibilityTag | null };

export const getUserFoodPreferenceResolutions = async (
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<FoodPreferenceResolution[]> => {
	const { data, error } = await supabase
		.from("user_compatibility_rules")
		.select(
			"raw_value, normalized_value, rule_type, resolution_status, resolution_method, resolution_policy_version_id, resolution_language_code, ingredient_term_id, ingredient_alias_id, preference_term_mapping_id, tag:compatibility_tags!user_compatibility_rules_tag_id_fkey(id, slug, label, category)",
		)
		.eq("user_id", userId)
		.eq("active", true)
		.order("rule_type", { ascending: true })
		.order("normalized_value", { ascending: true });

	if (error) throw error;

	return ((data ?? []) as unknown as ResolutionRow[]).map((row) => ({
		rawValue: row.raw_value,
		normalizedValue: row.normalized_value,
		ruleType: row.rule_type as FoodPreferenceRuleType,
		status: row.resolution_status as FoodPreferenceResolutionStatus,
		method: row.resolution_method as FoodPreferenceResolutionMethod,
		policyVersionId: row.resolution_policy_version_id,
		languageCode: row.resolution_language_code,
		ingredientTermId: row.ingredient_term_id,
		ingredientAliasId: row.ingredient_alias_id,
		preferenceTermMappingId: row.preference_term_mapping_id,
		tag: row.tag
			? {
					id: row.tag.id,
					slug: row.tag.slug,
					label: row.tag.label,
					category: row.tag.category,
				}
			: null,
	}));
};
