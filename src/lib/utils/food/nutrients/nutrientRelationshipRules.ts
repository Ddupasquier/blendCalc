import type { Database } from "$lib/types/database.types";
import type { FdcFood } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	getAppIssueMessage,
	type AppIssueParams,
} from "$lib/utils/errors/appIssues";

export type NutrientRelationshipSeverity = "error" | "warning";
export type NutrientRelationshipRuleType = "child_must_not_exceed_parent";

export type NutrientRelationshipRule = {
	id: string;
	parentNutrientId: number;
	childNutrientId: number;
	parentLabel: string;
	childLabel: string;
	relationship: NutrientRelationshipRuleType;
	severity: NutrientRelationshipSeverity;
	issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT";
	requiresParent: boolean;
	tolerance: number;
};

export type NutrientRelationshipIssue = {
	ruleId: string;
	parentNutrientId: number;
	childNutrientId: number;
	severity: NutrientRelationshipSeverity;
	code: "NUTRIENT_CHILD_EXCEEDS_PARENT";
	params: AppIssueParams;
	message: string;
};

type NutrientRelationshipRuleRow = {
	id: string;
	parent_nutrient_id: number;
	child_nutrient_id: number;
	relationship: string;
	severity: string;
	issue_code: "NUTRIENT_CHILD_EXCEEDS_PARENT";
	requires_parent: boolean;
	tolerance: number;
	parent_definition: { nutrient_name: string } | null;
	child_definition: { nutrient_name: string } | null;
};

export type NutrientValueMap = Map<number, number> | Record<number, number | undefined>;

const getNutrientValue = (values: NutrientValueMap, nutrientId: number) => {
	const rawValue = values instanceof Map ? values.get(nutrientId) : values[nutrientId];
	return typeof rawValue === "number" && Number.isFinite(rawValue)
		? rawValue
		: undefined;
};

const toRule = (row: NutrientRelationshipRuleRow): NutrientRelationshipRule => ({
	id: row.id,
	parentNutrientId: row.parent_nutrient_id,
	childNutrientId: row.child_nutrient_id,
	parentLabel: row.parent_definition?.nutrient_name ?? "its total",
	childLabel: row.child_definition?.nutrient_name ?? "This nutrient",
	relationship: row.relationship as NutrientRelationshipRuleType,
	severity: row.severity as NutrientRelationshipSeverity,
	issueCode: row.issue_code,
	requiresParent: row.requires_parent,
	tolerance: Number(row.tolerance ?? 0),
});

export const readNutrientRelationshipRules = async (
	supabase: SupabaseClient<Database> | null,
): Promise<NutrientRelationshipRule[] | null> => {
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("nutrient_relationship_rules")
		.select(
			"id, parent_nutrient_id, child_nutrient_id, relationship, severity, issue_code, requires_parent, tolerance, parent_definition:nutrient_definitions!nutrient_relationship_rules_parent_nutrient_id_fkey(nutrient_name), child_definition:nutrient_definitions!nutrient_relationship_rules_child_nutrient_id_fkey(nutrient_name)",
		)
		.eq("enabled", true)
		.order("sort_order", { ascending: true })
		.order("id", { ascending: true });

	if (error) {
		if (import.meta.env.DEV) {
			console.error("Unable to load nutrient relationship rules", error);
		}
		return null;
	}

	return (data ?? []).map((row) => toRule(row as NutrientRelationshipRuleRow));
};

export const createNutrientValueMapFromFood = (food: FdcFood) => {
	const values = new Map<number, number>();
	for (const nutrient of food.foodNutrients ?? []) {
		if (!Number.isFinite(nutrient.nutrientId) || !Number.isFinite(nutrient.value)) {
			continue;
		}
		values.set(nutrient.nutrientId, nutrient.value);
	}
	return values;
};

export const validateNutrientRelationshipRules = (
	values: NutrientValueMap,
	rules: NutrientRelationshipRule[],
): NutrientRelationshipIssue[] => {
	const issues: NutrientRelationshipIssue[] = [];

	for (const rule of rules) {
		const params = {
			parentLabel: rule.parentLabel,
			childLabel: rule.childLabel,
		};
		const childValue = getNutrientValue(values, rule.childNutrientId);
		if (childValue === undefined || childValue <= 0) continue;

		const parentValue = getNutrientValue(values, rule.parentNutrientId);
		if (parentValue === undefined) {
			if (rule.requiresParent) {
				issues.push({
					ruleId: rule.id,
					parentNutrientId: rule.parentNutrientId,
					childNutrientId: rule.childNutrientId,
					severity: rule.severity,
					code: rule.issueCode,
					params,
					message: getAppIssueMessage(rule.issueCode, params),
				});
			}
			continue;
		}

		if (rule.relationship === "child_must_not_exceed_parent") {
			const allowedMaximum = parentValue + rule.tolerance;
			if (childValue > allowedMaximum) {
				issues.push({
					ruleId: rule.id,
					parentNutrientId: rule.parentNutrientId,
					childNutrientId: rule.childNutrientId,
					severity: rule.severity,
					code: rule.issueCode,
					params,
					message: getAppIssueMessage(rule.issueCode, params),
				});
			}
		}
	}

	return issues;
};
