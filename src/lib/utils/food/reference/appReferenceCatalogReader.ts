import type { Database, Json } from "$lib/types/database.types";
import type {
	AppReferenceCatalog,
	MixRuntimeConfiguration,
	NutrientDisplayProfile,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { NutrientDefinitionReferenceRecord } from "$lib/utils/food/nutrients/nutrientDefinitionRecord";
import {
  getGoalTemplateSelectionId,
  isMixGoalBasis,
  isMixGoalType,
  type MixGoalMap,
} from "$lib/utils/mix/goals/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const asNumber = (value: unknown, label: string) => {
	const result = Number(value);
  if (!Number.isFinite(result))
    throw new Error(`${label} is not a valid number.`);
	return result;
};

const asNumberRecord = (value: Json | undefined, label: string) => {
	if (!value || Array.isArray(value) || typeof value !== "object") {
		throw new Error(`${label} is not a number map.`);
	}
	return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      asNumber(item, `${label}.${key}`),
    ]),
	);
};

const readRuntimeConfiguration = (
	rows: Array<{ key: string; value: Json }>,
): MixRuntimeConfiguration => {
	const values = new Map(rows.map((row) => [row.key, row.value]));
	const thresholds = asNumberRecord(
		values.get("progress-thresholds"),
		"Mix progress thresholds",
	);
	return {
		progressThresholds: {
			atGoal: asNumber(thresholds.atGoal, "Mix at-goal threshold"),
			barelyOver: asNumber(thresholds.barelyOver, "Mix barely-over threshold"),
			midwayOver: asNumber(thresholds.midwayOver, "Mix midway-over threshold"),
		},
		pointGoalTolerance: asNumber(
			values.get("point-goal-tolerance"),
			"Mix point-goal tolerance",
		),
		defaultServingGrams: asNumber(
			values.get("default-serving-grams"),
			"Mix default serving grams",
		),
	};
};

export const readAppReferenceCatalog = async (
	supabase: SupabaseClient<Database>,
	nutrientDefinitions?: NutrientDefinitionReferenceRecord[],
): Promise<AppReferenceCatalog> => {
	const definitionsPromise = nutrientDefinitions
		? Promise.resolve({ data: nutrientDefinitions, error: null })
		: supabase
				.from("nutrient_definitions")
				.select(
					"nutrient_id, nutrient_name, nutrient_number, default_unit_name",
				)
				.order("nutrient_name", { ascending: true });
	const [
		definitionsResult,
		profilesResult,
		profileFieldsResult,
		equivalencesResult,
		templatesResult,
    templateVersionsResult,
		templateTargetsResult,
			runtimeResult,
			symbolsResult,
			symbolRulesResult,
		] = await Promise.all([
		definitionsPromise,
		supabase
			.from("nutrient_display_profiles")
			.select("key, display_name, purpose, version")
			.eq("enabled", true),
		supabase
			.from("nutrient_display_profile_fields")
      .select(
        "profile_key, nutrient_id, display_label, display_unit, sort_order, highlight, default_goal",
      )
			.order("sort_order", { ascending: true }),
		supabase
			.from("nutrient_equivalences")
      .select(
        "canonical_nutrient_id, source_nutrient_id, source_nutrient_number, source_key",
      )
			.eq("enabled", true),
		supabase
			.from("mix_goal_templates")
      .select("key, sort_order, current_version_id, is_default")
			.eq("enabled", true)
			.order("sort_order", { ascending: true }),
    supabase
      .from("mix_goal_template_versions")
      .select(
        "id, template_key, version, display_name, description, goal_basis, status, source_key, source_reference, reviewed_at",
      )
      .eq("status", "active"),
		supabase
			.from("mix_goal_template_targets")
      .select(
        "template_version_id, nutrient_id, goal_type, target_amount, upper_amount, tolerance_ratio, importance_weight, sort_order, rationale, source_key, source_reference",
      )
      .order("sort_order", { ascending: true }),
		supabase
			.from("mix_runtime_configuration")
			.select("key, value")
			.eq("enabled", true),
		supabase
				.from("food_symbol_definitions")
				.select("key, display_name, emoji, sort_order")
				.eq("enabled", true)
				.order("sort_order", { ascending: true }),
			supabase
				.from("food_symbol_category_rules")
				.select("symbol_key, match_pattern, priority")
				.eq("enabled", true)
				.order("priority", { ascending: true }),
		]);

	for (const result of [
		definitionsResult,
		profilesResult,
		profileFieldsResult,
		equivalencesResult,
		templatesResult,
    templateVersionsResult,
		templateTargetsResult,
			runtimeResult,
			symbolsResult,
			symbolRulesResult,
		]) {
		if (result.error) throw result.error;
	}

	const nutrients = (definitionsResult.data ?? []).map((definition) => ({
		id: definition.nutrient_id,
		label: definition.nutrient_name,
		unit: definition.default_unit_name,
		nutrientNumber: definition.nutrient_number ?? "",
	}));
  const nutrientsById = new Map(
    nutrients.map((nutrient) => [nutrient.id, nutrient]),
  );
	const fieldsByProfile = new Map<string, NutrientDisplayProfile["fields"]>();
	for (const row of profileFieldsResult.data ?? []) {
		const nutrient = nutrientsById.get(row.nutrient_id);
    if (!nutrient)
      throw new Error(
        `Display profile nutrient ${row.nutrient_id} has no definition.`,
      );
		const fields = fieldsByProfile.get(row.profile_key) ?? [];
		fields.push({
			...nutrient,
			label: row.display_label ?? nutrient.label,
			unit: row.display_unit ?? nutrient.unit,
			sortOrder: row.sort_order,
			highlight: row.highlight,
			defaultGoal: row.default_goal === null ? null : Number(row.default_goal),
		});
		fieldsByProfile.set(row.profile_key, fields);
	}

	const validPurposes = new Set<NutrientDisplayProfile["purpose"]>([
		"nutrition_facts",
		"mix_default",
		"mix_popular",
	]);
	const nutrientDisplayProfiles = (profilesResult.data ?? []).map((profile) => {
    if (
      !validPurposes.has(profile.purpose as NutrientDisplayProfile["purpose"])
    ) {
      throw new Error(
        `Unsupported nutrient display purpose ${profile.purpose}.`,
      );
		}
		return {
			key: profile.key,
			displayName: profile.display_name,
			purpose: profile.purpose as NutrientDisplayProfile["purpose"],
			version: profile.version,
			fields: fieldsByProfile.get(profile.key) ?? [],
		};
	});

  const targetsByTemplateVersion = new Map<string, MixGoalMap>();
	for (const target of templateTargetsResult.data ?? []) {
    if (!isMixGoalType(target.goal_type)) {
      throw new Error(`Unsupported Mix goal type ${target.goal_type}.`);
    }
    const goals =
      targetsByTemplateVersion.get(target.template_version_id) ?? {};
    goals[target.nutrient_id] = {
      nutrientId: target.nutrient_id,
      goalType: target.goal_type,
      targetAmount: Number(target.target_amount),
      upperAmount:
        target.upper_amount === null ? null : Number(target.upper_amount),
      toleranceRatio: Number(target.tolerance_ratio),
      importanceWeight: Number(target.importance_weight),
      sortOrder: target.sort_order,
      rationale: target.rationale,
      sourceKey: target.source_key,
      sourceReference: target.source_reference,
    };
    targetsByTemplateVersion.set(target.template_version_id, goals);
	}
  const versionsById = new Map(
    (templateVersionsResult.data ?? []).map((version) => [version.id, version]),
  );

	return {
		nutrients,
		nutrientDisplayProfiles,
		nutrientEquivalences: (equivalencesResult.data ?? []).map((row) => ({
			canonicalNutrientId: row.canonical_nutrient_id,
			sourceNutrientId: row.source_nutrient_id,
			sourceNutrientNumber: row.source_nutrient_number,
			sourceKey: row.source_key,
		})),
    mixGoalTemplates: (templatesResult.data ?? []).map((template) => {
      const version = template.current_version_id
        ? versionsById.get(template.current_version_id)
        : null;
      if (!version || version.template_key !== template.key) {
        throw new Error(
          `Mix goal template ${template.key} has no active current version.`,
        );
      }
      if (!isMixGoalBasis(version.goal_basis)) {
        throw new Error(`Unsupported Mix goal basis ${version.goal_basis}.`);
      }
      return {
			id: template.key,
        selectionId: getGoalTemplateSelectionId("system", version.id),
        scope: "system" as const,
        versionId: version.id,
        version: version.version,
        label: version.display_name,
        description: version.description,
        goalBasis: version.goal_basis,
        goals: targetsByTemplateVersion.get(version.id) ?? {},
        sourceKey: version.source_key,
        sourceReference: version.source_reference,
        reviewedAt: version.reviewed_at,
        isDefault: template.is_default,
      };
    }),
		mixRuntime: readRuntimeConfiguration(runtimeResult.data ?? []),
		foodSymbols: (symbolsResult.data ?? []).map((symbol) => ({
			key: symbol.key,
			label: symbol.display_name,
			emoji: symbol.emoji,
		})),
		foodSymbolCategoryRules: (symbolRulesResult.data ?? []).map((rule) => ({
			symbolKey: rule.symbol_key,
			matchPattern: rule.match_pattern,
			priority: rule.priority,
		})),
	};
};
