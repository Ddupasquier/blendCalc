import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";

export type ExpectedManualEntryNutrientField = {
	label: string;
	required: boolean;
};

export type ExpectedManualEntryNutrientGroup = {
	title: string;
	fields: ExpectedManualEntryNutrientField[];
};

export type ExpectedManualEntryNutrientCatalog = Record<
	"macros" | "extended",
	ExpectedManualEntryNutrientGroup[]
>;

const unitLabels: Record<string, string> = {
	G: "g",
	MG: "mg",
	UG: "mcg",
	MCG: "mcg",
	KCAL: "kcal",
	IU: "IU",
};

const formatNutrientLabel = (nutrientName: string, unitName: string) => {
	const normalizedUnitName = unitName.trim().toUpperCase();
	const displayUnit =
		unitLabels[normalizedUnitName] ?? normalizedUnitName.toLowerCase();
	return displayUnit ? `${nutrientName} (${displayUnit})` : nutrientName;
};

export const readApprovedManualEntryNutrientCatalog = async (
	supabase: SupabaseClient<Database>,
): Promise<ExpectedManualEntryNutrientCatalog> => {
	const [groupsResult, fieldsResult, requiredNutrientsResult] = await Promise.all([
		supabase
			.from("nutrient_manual_entry_groups")
			.select("id, entry_step, title, sort_order")
			.eq("enabled", true)
			.eq("group_role", "display"),
		supabase
			.from("nutrient_manual_entry_fields")
			.select("nutrient_id, group_id, display_label, sort_order, dedupe_key")
			.eq("enabled", true)
			.eq("classification_status", "approved"),
		supabase
			.from("nutrient_manual_entry_required_nutrients")
			.select("nutrient_id, group_id, field_sort_order")
			.eq("enabled", true),
	]);

	if (groupsResult.error) throw groupsResult.error;
	if (fieldsResult.error) throw fieldsResult.error;
	if (requiredNutrientsResult.error) throw requiredNutrientsResult.error;

	const nutrientIds = [
		...new Set((fieldsResult.data ?? []).map((field) => field.nutrient_id)),
	];
	const nutrientsResult = await supabase
		.from("nutrient_definitions")
		.select("nutrient_id, nutrient_name, default_unit_name")
		.in("nutrient_id", nutrientIds);
	if (nutrientsResult.error) throw nutrientsResult.error;

	const groupsById = new Map(
		(groupsResult.data ?? []).map((group) => [group.id, group]),
	);
	const nutrientsById = new Map(
		(nutrientsResult.data ?? []).map((nutrient) => [
			nutrient.nutrient_id,
			nutrient,
		]),
	);
	const requiredNutrientsById = new Map(
		(requiredNutrientsResult.data ?? []).map((nutrient) => [
			nutrient.nutrient_id,
			nutrient,
		]),
	);

	const hydratedFields = (fieldsResult.data ?? []).flatMap((field) => {
		const requiredNutrient = requiredNutrientsById.get(field.nutrient_id);
		const group = groupsById.get(requiredNutrient?.group_id ?? field.group_id);
		const nutrient = nutrientsById.get(field.nutrient_id);
		if (
			!group ||
			!nutrient ||
			(group.entry_step !== "macros" && group.entry_step !== "extended")
		) {
			return [];
		}

		return [{
			dedupeKey: field.dedupe_key,
			nutrientId: field.nutrient_id,
			nutrientName: nutrient.nutrient_name,
			step: group.entry_step,
			groupTitle: group.title,
			groupSort: group.sort_order,
			fieldSort: requiredNutrient?.field_sort_order ?? field.sort_order,
			label:
				field.display_label ??
				formatNutrientLabel(
					nutrient.nutrient_name,
					nutrient.default_unit_name,
				),
			required: Boolean(requiredNutrient),
		}];
	});

	const deduplicatedFields = new Map<
		string,
		(typeof hydratedFields)[number]
	>();
	for (const field of hydratedFields) {
		const existing = deduplicatedFields.get(field.dedupeKey);
		if (
			!existing ||
			field.fieldSort < existing.fieldSort ||
			(field.fieldSort === existing.fieldSort &&
				field.groupSort < existing.groupSort) ||
			(field.fieldSort === existing.fieldSort &&
				field.groupSort === existing.groupSort &&
				field.nutrientName.localeCompare(existing.nutrientName) < 0) ||
			(field.fieldSort === existing.fieldSort &&
				field.groupSort === existing.groupSort &&
				field.nutrientName === existing.nutrientName &&
				field.nutrientId < existing.nutrientId)
		) {
			deduplicatedFields.set(field.dedupeKey, field);
		}
	}

	const catalog: ExpectedManualEntryNutrientCatalog = {
		macros: [],
		extended: [],
	};
	for (const step of ["macros", "extended"] as const) {
		const stepFields = [...deduplicatedFields.values()].filter(
			(field) => field.step === step,
		);
		const groupTitles = [
			...new Set(
				stepFields
					.sort(
						(left, right) =>
							left.groupSort - right.groupSort ||
							left.groupTitle.localeCompare(right.groupTitle),
					)
					.map((field) => field.groupTitle),
			),
		];

		catalog[step] = groupTitles.map((title) => ({
			title,
			fields: stepFields
				.filter((field) => field.groupTitle === title)
				.sort(
					(left, right) =>
						left.fieldSort - right.fieldSort ||
						left.nutrientName.localeCompare(right.nutrientName),
				)
				.map((field) => ({ label: field.label, required: field.required })),
		}));
	}

	return catalog;
};
