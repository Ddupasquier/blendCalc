import type { Database } from "$lib/types/database.types";
import type { FdcFood } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NutrientRelationshipSeverity = "error" | "warning";
export type NutrientRelationshipRuleType = "child_must_not_exceed_parent";

export type NutrientRelationshipRule = {
	id: string;
	parentNutrientId: number;
	childNutrientId: number;
	relationship: NutrientRelationshipRuleType;
	severity: NutrientRelationshipSeverity;
	message: string;
	requiresParent: boolean;
	tolerance: number;
};

export type NutrientRelationshipIssue = {
	ruleId: string;
	parentNutrientId: number;
	childNutrientId: number;
	severity: NutrientRelationshipSeverity;
	message: string;
};

type NutrientRelationshipRuleRow = Pick<
	Database["public"]["Tables"]["nutrient_relationship_rules"]["Row"],
	| "id"
	| "parent_nutrient_id"
	| "child_nutrient_id"
	| "relationship"
	| "severity"
	| "message"
	| "requires_parent"
	| "tolerance"
>;

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
	relationship: row.relationship as NutrientRelationshipRuleType,
	severity: row.severity as NutrientRelationshipSeverity,
	message: row.message,
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
			"id, parent_nutrient_id, child_nutrient_id, relationship, severity, message, requires_parent, tolerance",
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
					message: rule.message,
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
					message: rule.message,
				});
			}
		}
	}

	return issues;
};
