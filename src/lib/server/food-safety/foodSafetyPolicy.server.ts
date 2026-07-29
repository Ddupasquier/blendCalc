import { createServerCachedLoader } from "$lib/server/cache/serverCachedLoader";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

export type FoodPreferenceConflictRule = {
	preferenceSlug: string;
	preferenceLabel: string;
	preferenceCategory?: "allergen" | "dietary" | "ingredient" | "avoidance";
	factSlug: string;
	factLabel: string;
	level: "warning" | "potential";
	warningCode: "FOOD_RESTRICTION_CONFLICT";
	priority: number;
};

export type FoodCompatibilityMatchRule = {
	sourceKey: string | null;
	fieldName:
		| "ingredients"
		| "generic_food_identity"
		| "allergens"
		| "traces"
		| "ingredient_analysis";
	matchPattern: string;
	excludePattern: string | null;
	tagSlug: string;
	tagLabel: string;
	tagCategory: "allergen" | "dietary" | "ingredient" | "avoidance";
	factType:
		| "ingredient_present"
		| "contains"
		| "may_contain"
		| "dietary_conflict";
	sourceType:
		| "label_ingredient_field"
		| "food_identity_taxonomy"
		| "label_allergen_field"
		| "label_trace_field"
		| "source_dietary_analysis";
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
					"severity, warning_code, priority, preference_tag:compatibility_tags!compatibility_rule_conflicts_preference_tag_id_fkey(slug, label, category), fact_tag:compatibility_tags!compatibility_rule_conflicts_fact_tag_id_fkey(slug, label)",
				)
				.order("priority", { ascending: true }),
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
				priority: number;
				preference_tag: {
					slug: string;
					label: string;
					category: "allergen" | "dietary" | "ingredient" | "avoidance";
				};
				fact_tag: { slug: string; label: string };
			}>
		).map((rule) => ({
			preferenceSlug: rule.preference_tag.slug,
			preferenceLabel: rule.preference_tag.label,
			preferenceCategory: rule.preference_tag.category,
			factSlug: rule.fact_tag.slug,
			factLabel: rule.fact_tag.label,
			level: rule.severity,
			warningCode: rule.warning_code,
			priority: rule.priority,
		}));

		const compatibilityMatchRules = (
			(matchRulesResult.data ?? []) as unknown as Array<{
				source_key: string | null;
				field_name:
					| "ingredients"
					| "generic_food_identity"
					| "allergens"
					| "traces"
					| "ingredient_analysis";
				match_pattern: string;
				exclude_pattern: string | null;
				fact_type:
					| "ingredient_present"
					| "contains"
					| "may_contain"
					| "dietary_conflict";
				source_type:
					| "label_ingredient_field"
					| "food_identity_taxonomy"
					| "label_allergen_field"
					| "label_trace_field"
					| "source_dietary_analysis";
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
