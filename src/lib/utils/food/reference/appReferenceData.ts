import type { Database, Json } from "$lib/types/database.types";
import type {
	AppReferenceCatalog,
	MixRuntimeConfiguration,
	NutrientDisplayProfile,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { NutrientDefinitionReferenceRecord } from "$lib/utils/food/nutrients/nutrientDefinitionRecord";
import type { SupabaseClient } from "@supabase/supabase-js";

const asNumber = (value: unknown, label: string) => {
	const result = Number(value);
	if (!Number.isFinite(result)) throw new Error(`${label} is not a valid number.`);
	return result;
};

const asNumberRecord = (value: Json | undefined, label: string) => {
	if (!value || Array.isArray(value) || typeof value !== "object") {
		throw new Error(`${label} is not a number map.`);
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, asNumber(item, `${label}.${key}`)]),
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
		defaultGoalByUnit: asNumberRecord(
			values.get("default-goal-by-unit"),
			"Mix default goals by unit",
		),
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
			.select("profile_key, nutrient_id, display_label, display_unit, sort_order, highlight, default_goal")
			.order("sort_order", { ascending: true }),
		supabase
			.from("nutrient_equivalences")
			.select("canonical_nutrient_id, source_nutrient_id, source_nutrient_number, source_key")
			.eq("enabled", true),
		supabase
			.from("mix_goal_templates")
			.select("key, display_name, description, sort_order")
			.eq("enabled", true)
			.order("sort_order", { ascending: true }),
		supabase
			.from("mix_goal_template_targets")
			.select("template_key, nutrient_id, target_amount"),
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
	const nutrientsById = new Map(nutrients.map((nutrient) => [nutrient.id, nutrient]));
	const fieldsByProfile = new Map<string, NutrientDisplayProfile["fields"]>();
	for (const row of profileFieldsResult.data ?? []) {
		const nutrient = nutrientsById.get(row.nutrient_id);
		if (!nutrient) throw new Error(`Display profile nutrient ${row.nutrient_id} has no definition.`);
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
		if (!validPurposes.has(profile.purpose as NutrientDisplayProfile["purpose"])) {
			throw new Error(`Unsupported nutrient display purpose ${profile.purpose}.`);
		}
		return {
			key: profile.key,
			displayName: profile.display_name,
			purpose: profile.purpose as NutrientDisplayProfile["purpose"],
			version: profile.version,
			fields: fieldsByProfile.get(profile.key) ?? [],
		};
	});

	const targetsByTemplate = new Map<string, Record<number, number>>();
	for (const target of templateTargetsResult.data ?? []) {
		const goals = targetsByTemplate.get(target.template_key) ?? {};
		goals[target.nutrient_id] = Number(target.target_amount);
		targetsByTemplate.set(target.template_key, goals);
	}

	return {
		nutrients,
		nutrientDisplayProfiles,
		nutrientEquivalences: (equivalencesResult.data ?? []).map((row) => ({
			canonicalNutrientId: row.canonical_nutrient_id,
			sourceNutrientId: row.source_nutrient_id,
			sourceNutrientNumber: row.source_nutrient_number,
			sourceKey: row.source_key,
		})),
		mixGoalTemplates: (templatesResult.data ?? []).map((template) => ({
			id: template.key,
			label: template.display_name,
			description: template.description,
			goals: targetsByTemplate.get(template.key) ?? {},
		})),
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
