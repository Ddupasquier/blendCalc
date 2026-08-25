import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import type {
	NutritionCompletenessCatalog,
	NutritionCompletenessProfile,
	NutritionCompletenessProfileScope,
	NutritionRequirementLevel,
} from "$lib/utils/food/quality/nutritionCompletenessCatalog";
import { readProductRegulatoryDisclosureProfiles } from "$lib/utils/food/quality/productRegulatoryDisclosureProfiles";
import type { NutrientDefinitionReferenceRecord } from "$lib/utils/food/nutrients/nutrientDefinitionRecord";

export const readNutritionCompletenessCatalog = async (
	supabase: SupabaseClient<Database>,
	nutrientDefinitions?: NutrientDefinitionReferenceRecord[],
): Promise<NutritionCompletenessCatalog> => {
	const definitionsPromise = nutrientDefinitions
		? Promise.resolve({ data: nutrientDefinitions, error: null })
		: supabase
				.from("nutrient_definitions")
				.select("nutrient_id, nutrient_name, default_unit_name");
	const [
		profilesResult,
		profileNutrientsResult,
		definitionsResult,
		disclosureProfilesResult,
	] = await Promise.all([
		supabase
			.from("nutrition_completeness_profiles")
			.select(
				"key, assessment_policy_key, display_name, food_scope, region_code, complete_label, resolved_label, partial_label, limited_label, description, source_key, source_reference, is_default, exact_source_score, mapped_source_score, derived_source_score, missing_source_score, required_nutrient_weight, recommended_nutrient_weight, partial_minimum_ratio",
			)
			.eq("enabled", true)
			.order("food_scope", { ascending: true })
			.order("region_code", { ascending: true })
			.order("key", { ascending: true }),
		supabase
			.from("nutrition_completeness_profile_nutrients")
			.select(
				"profile_key, nutrient_id, requirement_level, display_order, reason",
			)
			.order("profile_key", { ascending: true })
			.order("display_order", { ascending: true }),
		definitionsPromise,
		readProductRegulatoryDisclosureProfiles(supabase),
	]);

	if (profilesResult.error) throw profilesResult.error;
	if (profileNutrientsResult.error) throw profileNutrientsResult.error;
	if (definitionsResult.error) throw definitionsResult.error;

	const definitions = new Map(
		(definitionsResult.data ?? []).map((definition) => [
			definition.nutrient_id,
			definition,
		]),
	);
	const profileRows = profilesResult.data ?? [];
	const enabledProfileKeys = new Set(profileRows.map((profile) => profile.key));
	const nutrientsByProfile = new Map<
		string,
		NutritionCompletenessProfile["nutrients"]
	>();

	for (const row of profileNutrientsResult.data ?? []) {
		if (!enabledProfileKeys.has(row.profile_key)) continue;
		const definition = definitions.get(row.nutrient_id);
		if (!definition) {
			throw new Error(
				`Nutrition completeness nutrient ${row.nutrient_id} has no definition.`,
			);
		}
		if (
			row.requirement_level !== "required" &&
			row.requirement_level !== "recommended"
		) {
			throw new Error(
				`Nutrition completeness requirement ${row.requirement_level} is not supported.`,
			);
		}
		const nutrients = nutrientsByProfile.get(row.profile_key) ?? [];
		nutrients.push({
			nutrientId: row.nutrient_id,
			label: definition.nutrient_name,
			unitName: definition.default_unit_name,
			requirementLevel: row.requirement_level as NutritionRequirementLevel,
			displayOrder: row.display_order,
			reason: row.reason,
		});
		nutrientsByProfile.set(row.profile_key, nutrients);
	}

	const profiles = profileRows.map((row) => {
		if (
			row.food_scope !== "generic" &&
			row.food_scope !== "manual" &&
			row.food_scope !== "packaged"
		) {
			throw new Error(
				`Nutrition completeness scope ${row.food_scope} is not supported.`,
			);
		}
		const nutrients = nutrientsByProfile.get(row.key) ?? [];
		if (
			!nutrients.some((nutrient) => nutrient.requirementLevel === "required")
		) {
			throw new Error(
				`Nutrition completeness profile ${row.key} has no required nutrients.`,
			);
		}

		return {
			key: row.key,
			assessmentPolicyKey: row.assessment_policy_key,
			displayName: row.display_name,
			foodScope: row.food_scope as NutritionCompletenessProfileScope,
			regionCode: row.region_code,
			completeLabel: row.complete_label,
			resolvedLabel: row.resolved_label,
			partialLabel: row.partial_label,
			limitedLabel: row.limited_label,
			description: row.description,
			sourceKey: row.source_key,
			sourceReference: row.source_reference,
			isDefault: row.is_default,
			exactSourceScore: row.exact_source_score,
			mappedSourceScore: row.mapped_source_score,
			derivedSourceScore: row.derived_source_score,
			missingSourceScore: row.missing_source_score,
			requiredNutrientWeight: row.required_nutrient_weight,
			recommendedNutrientWeight: row.recommended_nutrient_weight,
			partialMinimumRatio: row.partial_minimum_ratio,
			nutrients,
		} satisfies NutritionCompletenessProfile;
	});

	if (profiles.length === 0) {
		throw new Error(
			"No enabled nutrition completeness profiles are available.",
		);
	}

	const regulatoryDisclosureProfiles = disclosureProfilesResult;

	return { profiles, regulatoryDisclosureProfiles };
};
