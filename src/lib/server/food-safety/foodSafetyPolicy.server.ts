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

export type FoodAllergenRegionalProfile = {
	key: string;
	regionCode: string;
	displayName: string;
	authority: string;
	policyReference: string;
	sourceUrl: string;
	reviewedAt: string;
	tags: Array<{
		slug: string;
		label: string;
		classification:
			| "major_allergen"
			| "priority_allergen"
			| "regulated_allergen"
			| "gluten_source"
			| "regulated_sulphite";
		sourceLabel: string;
	}>;
};

export type FoodCompatibilityIngredientAlias = {
	ingredientTermId: string;
	termKey: string;
	termLabel: string;
	alias: string;
	normalizedAlias: string;
	languageCode: string | null;
	tagSlug: string;
	tagLabel: string;
	tagCategory: "allergen" | "dietary" | "ingredient" | "avoidance";
	preferenceRuleType: "allergen" | "dietary_restriction";
};

export type FoodCompatibilityPolicyExemption = {
	jurisdictionCode: string;
	ingredientTermId: string | null;
	ingredientTermKey: string | null;
	parentTermId: string | null;
	parentTermKey: string | null;
	factTagSlug: string | null;
	processingState: string | null;
	exemptionType: "labeling" | "threshold" | "processing";
	thresholdValue: number | null;
	thresholdUnit: string | null;
	productContext: Record<string, unknown>;
	warningBehavior: "context-only";
	sourceReference: string;
	reviewedAt: string;
};

export type FoodSafetyPolicy = {
	version: number;
	reviewedAt: string;
	preferenceConflictRules: FoodPreferenceConflictRule[];
	compatibilityMatchRules: FoodCompatibilityMatchRule[];
	regionalProfiles: FoodAllergenRegionalProfile[];
	ingredientAliases: FoodCompatibilityIngredientAlias[];
	policyExemptions: FoodCompatibilityPolicyExemption[];
	supportedIngredientLanguages: string[];
};

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

export const getFoodSafetyPolicy = createServerCachedLoader({
	load: async (): Promise<FoodSafetyPolicy> => {
		const supabase = getSupabaseAdminClient();
		const { data: policyVersion, error: policyVersionError } = await supabase
			.from("food_compatibility_policy_versions")
			.select("id, version_number, reviewed_at")
			.eq("status", "active")
			.order("version_number", { ascending: false })
			.limit(1)
			.single();

		if (policyVersionError) throw policyVersionError;

		const [
			conflictsResult,
			matchRulesResult,
			regionalProfilesResult,
			ingredientTermsResult,
			ingredientAliasesResult,
			preferenceMappingsResult,
			compatibilityTagsResult,
			exemptionsResult,
		] =
			await Promise.all([
			supabase
				.from("food_compatibility_policy_conflicts")
				.select(
					"severity, warning_code, priority, preference_tag:compatibility_tags!compatibility_rule_conflicts_preference_tag_id_fkey(slug, label, category), fact_tag:compatibility_tags!compatibility_rule_conflicts_fact_tag_id_fkey(slug, label)",
				)
				.eq("policy_version_id", policyVersion.id)
				.order("priority", { ascending: true }),
			supabase
				.from("food_compatibility_policy_match_rules")
				.select(
					"source_key, field_name, match_pattern, exclude_pattern, fact_type, source_type, confidence, priority, tag:compatibility_tags(slug, label, category)",
				)
				.eq("policy_version_id", policyVersion.id)
				.eq("enabled", true)
				.order("priority", { ascending: true }),
			supabase
				.from("food_allergen_regulatory_profiles")
				.select(
					"profile_key, region_code, display_name, authority, policy_reference, source_url, reviewed_at, profile_tags:food_allergen_regulatory_profile_tags(classification, source_label, tag:compatibility_tags(slug, label))",
				)
				.eq("policy_version_id", policyVersion.id)
					.eq("active", true)
					.order("region_code", { ascending: true }),
				supabase
					.from("ingredient_terms")
					.select("id, canonical_key, display_name")
					.eq("review_status", "reviewed"),
				supabase
					.from("food_compatibility_policy_ingredient_aliases")
					.select("ingredient_term_id, alias, normalized_alias, language_code")
					.eq("policy_version_id", policyVersion.id)
					.eq("review_status", "reviewed"),
				supabase
					.from("food_compatibility_policy_preference_term_mappings")
					.select(
						"ingredient_term_id, preference_rule_type, tag:compatibility_tags(slug, label, category)",
					)
					.eq("policy_version_id", policyVersion.id),
				supabase
					.from("compatibility_tags")
					.select("id, slug"),
				supabase
					.from("food_compatibility_policy_exemptions")
					.select(
						"jurisdiction_code, ingredient_term_id, parent_term_id, fact_tag_id, processing_state, exemption_type, threshold_value, threshold_unit, product_context, warning_behavior, source_reference, reviewed_at",
					)
					.eq("policy_version_id", policyVersion.id),
			]);

		if (conflictsResult.error) throw conflictsResult.error;
		if (matchRulesResult.error) throw matchRulesResult.error;
		if (regionalProfilesResult.error) throw regionalProfilesResult.error;
		if (ingredientTermsResult.error) throw ingredientTermsResult.error;
		if (ingredientAliasesResult.error) throw ingredientAliasesResult.error;
		if (preferenceMappingsResult.error) throw preferenceMappingsResult.error;
		if (compatibilityTagsResult.error) throw compatibilityTagsResult.error;
		if (exemptionsResult.error) throw exemptionsResult.error;

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

		const regionalProfiles = (
			(regionalProfilesResult.data ?? []) as unknown as Array<{
				profile_key: string;
				region_code: string;
				display_name: string;
				authority: string;
				policy_reference: string;
				source_url: string;
				reviewed_at: string;
				profile_tags: Array<{
					classification:
						| "major_allergen"
						| "priority_allergen"
						| "regulated_allergen"
						| "gluten_source"
						| "regulated_sulphite";
					source_label: string;
					tag: { slug: string; label: string };
				}>;
			}>
		).map((profile) => ({
			key: profile.profile_key,
			regionCode: profile.region_code,
			displayName: profile.display_name,
			authority: profile.authority,
			policyReference: profile.policy_reference,
			sourceUrl: profile.source_url,
			reviewedAt: profile.reviewed_at,
			tags: profile.profile_tags.map((profileTag) => ({
				slug: profileTag.tag.slug,
				label: profileTag.tag.label,
				classification: profileTag.classification,
				sourceLabel: profileTag.source_label,
			})),
		}));

		const ingredientTerms = new Map(
			((ingredientTermsResult.data ?? []) as Array<{
				id: string;
				canonical_key: string;
				display_name: string;
			}>).map((term) => [term.id, term]),
		);
		const preferenceMappings = new Map<string, Array<{
			preferenceRuleType: "allergen" | "dietary_restriction";
			tag: {
				slug: string;
				label: string;
				category: "allergen" | "dietary" | "ingredient" | "avoidance";
			};
		}>>();
		for (const mapping of (
			(preferenceMappingsResult.data ?? []) as unknown as Array<{
				ingredient_term_id: string;
				preference_rule_type: "allergen" | "dietary_restriction";
				tag: {
					slug: string;
					label: string;
					category: "allergen" | "dietary" | "ingredient" | "avoidance";
				};
			}>
		)) {
			const current = preferenceMappings.get(mapping.ingredient_term_id) ?? [];
			current.push({
				preferenceRuleType: mapping.preference_rule_type,
				tag: mapping.tag,
			});
			preferenceMappings.set(mapping.ingredient_term_id, current);
		}

		const ingredientAliases = (
			(ingredientAliasesResult.data ?? []) as Array<{
				ingredient_term_id: string;
				alias: string;
				normalized_alias: string;
				language_code: string | null;
			}>
		).flatMap((alias) => {
			const term = ingredientTerms.get(alias.ingredient_term_id);
			if (!term) return [];
			return (preferenceMappings.get(alias.ingredient_term_id) ?? []).map(
				(mapping): FoodCompatibilityIngredientAlias => ({
					ingredientTermId: alias.ingredient_term_id,
					termKey: term.canonical_key,
					termLabel: term.display_name,
					alias: alias.alias,
					normalizedAlias: alias.normalized_alias,
					languageCode: alias.language_code,
					tagSlug: mapping.tag.slug,
					tagLabel: mapping.tag.label,
					tagCategory: mapping.tag.category,
					preferenceRuleType: mapping.preferenceRuleType,
				}),
			);
		});

		const policyExemptions = (
			(exemptionsResult.data ?? []) as unknown as Array<{
				jurisdiction_code: string;
				ingredient_term_id: string | null;
				parent_term_id: string | null;
				fact_tag_id: string | null;
				processing_state: string | null;
				exemption_type: "labeling" | "threshold" | "processing";
				threshold_value: number | null;
				threshold_unit: string | null;
				product_context: Record<string, unknown>;
				warning_behavior: "context-only";
				source_reference: string;
				reviewed_at: string;
			}>
		).map((exemption) => ({
			jurisdictionCode: exemption.jurisdiction_code,
			ingredientTermId: exemption.ingredient_term_id,
			ingredientTermKey: exemption.ingredient_term_id
				? ingredientTerms.get(exemption.ingredient_term_id)?.canonical_key ?? null
				: null,
			parentTermId: exemption.parent_term_id,
			parentTermKey: exemption.parent_term_id
				? ingredientTerms.get(exemption.parent_term_id)?.canonical_key ?? null
				: null,
			factTagSlug: exemption.fact_tag_id
				? ((compatibilityTagsResult.data ?? []) as Array<{
					id: string;
					slug: string;
				}>).find((tag) => tag.id === exemption.fact_tag_id)?.slug ?? null
				: null,
			processingState: exemption.processing_state,
			exemptionType: exemption.exemption_type,
			thresholdValue: exemption.threshold_value,
			thresholdUnit: exemption.threshold_unit,
			productContext: exemption.product_context ?? {},
			warningBehavior: exemption.warning_behavior,
			sourceReference: exemption.source_reference,
			reviewedAt: exemption.reviewed_at,
		}));
		const supportedIngredientLanguages = [...new Set(
			ingredientAliases
				.map((alias) => alias.languageCode?.split("-")[0]?.toLowerCase() ?? "")
				.filter(Boolean),
		)].sort();

		return {
			version: policyVersion.version_number,
			reviewedAt: policyVersion.reviewed_at,
			preferenceConflictRules,
			compatibilityMatchRules,
			regionalProfiles,
			ingredientAliases,
			policyExemptions,
			supportedIngredientLanguages,
		};
	},
	ttlMilliseconds: CACHE_DURATION_MILLISECONDS,
});
