import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

export type FoodPreferenceConflictRule = {
	preferenceSlug: string;
	preferenceLabel: string;
	factSlug: string;
	factLabel: string;
	level: "warning" | "potential";
	warningCode: "FOOD_RESTRICTION_CONFLICT";
};

export type FoodCompatibilityMatchRule = {
	sourceKey: string | null;
	fieldName: "ingredients" | "generic_food_identity";
	matchPattern: string;
	excludePattern: string | null;
	tagSlug: string;
	tagLabel: string;
	tagCategory: "allergen" | "dietary" | "ingredient" | "avoidance";
	factType: "ingredient_present" | "contains";
	sourceType: "label_ingredient_field" | "food_identity_taxonomy";
	confidence: "confirmed" | "inferred" | "uncertain";
	priority: number;
};

export type FoodSafetyPolicy = {
	preferenceConflictRules: FoodPreferenceConflictRule[];
	compatibilityMatchRules: FoodCompatibilityMatchRule[];
};

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getFoodSafetyPolicy = createServerCachedLoader({
	load: async (): Promise<FoodSafetyPolicy> => {
		const supabase = getSupabaseAdminClient();
		const [conflictsResult, matchRulesResult] = await Promise.all([
			supabase
				.from("compatibility_rule_conflicts")
				.select(
					"severity, warning_code, preference_tag:compatibility_tags!compatibility_rule_conflicts_preference_tag_id_fkey(slug, label), fact_tag:compatibility_tags!compatibility_rule_conflicts_fact_tag_id_fkey(slug, label)",
				),
			supabase
				.from("food_compatibility_match_rules")
				.select(
					"source_key, field_name, match_pattern, exclude_pattern, fact_type, source_type, confidence, priority, tag:compatibility_tags(slug, label, category)",
				)
				.eq("enabled", true)
				.order("priority", { ascending: true }),
		]);

		if (conflictsResult.error) throw conflictsResult.error;
		if (matchRulesResult.error) throw matchRulesResult.error;

		const preferenceConflictRules = (
			(conflictsResult.data ?? []) as unknown as Array<{
				severity: "warning" | "potential";
				warning_code: "FOOD_RESTRICTION_CONFLICT";
				preference_tag: { slug: string; label: string };
				fact_tag: { slug: string; label: string };
			}>
		).map((rule) => ({
			preferenceSlug: rule.preference_tag.slug,
			preferenceLabel: rule.preference_tag.label,
			factSlug: rule.fact_tag.slug,
			factLabel: rule.fact_tag.label,
			level: rule.severity,
			warningCode: rule.warning_code,
		}));

		const compatibilityMatchRules = (
			(matchRulesResult.data ?? []) as unknown as Array<{
				source_key: string | null;
				field_name: "ingredients" | "generic_food_identity";
				match_pattern: string;
				exclude_pattern: string | null;
				fact_type: "ingredient_present" | "contains";
				source_type: "label_ingredient_field" | "food_identity_taxonomy";
				confidence: "confirmed" | "inferred" | "uncertain";
				priority: number;
				tag: {
					slug: string;
					label: string;
					category: "allergen" | "dietary" | "ingredient" | "avoidance";
				};
			}>
		).map((rule) => ({
			sourceKey: rule.source_key,
			fieldName: rule.field_name,
			matchPattern: rule.match_pattern,
			excludePattern: rule.exclude_pattern,
			tagSlug: rule.tag.slug,
			tagLabel: rule.tag.label,
			tagCategory: rule.tag.category,
			factType: rule.fact_type,
			sourceType: rule.source_type,
			confidence: rule.confidence,
			priority: rule.priority,
		}));

		return { preferenceConflictRules, compatibilityMatchRules };
	},
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
