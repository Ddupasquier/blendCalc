import type { Database } from "$lib/types/database.types";
import { formatNutrientUnitNameForDisplay } from "$lib/utils/food/nutrients/nutrientUnitNames";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ManualEntryNutrientStep = "macros" | "extended";

export type ManualEntryNutrientDefinition = {
	dedupeKey: string;
	nutrientId: number;
	nutrientName: string;
	nutrientNumber: string;
	unitName: string;
	nutrientType: string | null;
	step: ManualEntryNutrientStep;
	group: string;
	groupSort: number;
	sort: number;
	label: string;
	requiredForManualEntry: boolean;
};

export type ManualEntryNutrientGroup = {
	title: string;
	fields: ManualEntryNutrientDefinition[];
};

export type ManualEntryNutrientGroupsByStep = Record<
	ManualEntryNutrientStep,
	ManualEntryNutrientGroup[]
>;

type NutrientDefinitionRecord = Pick<
	Database["public"]["Tables"]["nutrient_definitions"]["Row"],
	"nutrient_id" | "nutrient_name" | "nutrient_number" | "default_unit_name"
>;

type ManualEntryGroupRecord = Pick<
	Database["public"]["Tables"]["nutrient_manual_entry_groups"]["Row"],
	"id" | "entry_step" | "title" | "sort_order"
>;

type ManualEntryFieldRecord = Pick<
	Database["public"]["Tables"]["nutrient_manual_entry_fields"]["Row"],
	| "nutrient_id"
	| "nutrient_type"
	| "group_id"
	| "display_label"
	| "required_for_manual_entry"
	| "sort_order"
	| "dedupe_key"
> & {
	nutrient_definitions: NutrientDefinitionRecord | null;
	nutrient_manual_entry_groups: ManualEntryGroupRecord | null;
};

type RawManualEntryFieldRecord = Pick<
	Database["public"]["Tables"]["nutrient_manual_entry_fields"]["Row"],
	| "nutrient_id"
	| "nutrient_type"
	| "group_id"
	| "display_label"
	| "required_for_manual_entry"
	| "sort_order"
	| "dedupe_key"
>;

type RequiredManualEntryNutrientRecord = Pick<
	Database["public"]["Tables"]["nutrient_manual_entry_required_nutrients"]["Row"],
	"nutrient_id" | "group_id" | "field_sort_order"
>;

const normalizeDedupePart = (value: string) =>
	value
		.toLowerCase()
		.replace(/\([^)]*\)/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\btotal\b/g, "")
		.replace(/\s+/g, " ")
		.trim();

const buildFallbackDedupeKey = ({
	step,
	group,
	label,
	unitName,
}: Pick<
	ManualEntryNutrientDefinition,
	"step" | "group" | "label" | "unitName"
>) =>
	[
		step,
		normalizeDedupePart(group),
		normalizeDedupePart(label),
		formatNutrientUnitNameForDisplay(unitName),
	]
		.filter(Boolean)
		.join(":");

export const formatNutrientDefinitionLabel = (
	nutrientName: string,
	unitName: string,
) => {
	const displayUnit = formatNutrientUnitNameForDisplay(unitName);
	return displayUnit ? `${nutrientName} (${displayUnit})` : nutrientName;
};

const isManualEntryStep = (
	step: string | null,
): step is ManualEntryNutrientStep => step === "macros" || step === "extended";

const toManualEntryNutrientDefinition = (
	record: ManualEntryFieldRecord,
): ManualEntryNutrientDefinition | null => {
	const group = record.nutrient_manual_entry_groups;
	if (!group || !isManualEntryStep(group.entry_step)) return null;
	if (!record.nutrient_definitions) return null;

	const nutrientDefinition = record.nutrient_definitions;
	const unitName = nutrientDefinition.default_unit_name;
	const label =
		record.display_label ??
		formatNutrientDefinitionLabel(nutrientDefinition.nutrient_name, unitName);
	const step = group.entry_step;
	const groupTitle = group.title;
	return {
		dedupeKey:
			record.dedupe_key ??
			buildFallbackDedupeKey({
				step,
				group: groupTitle,
				label,
				unitName,
			}),
		nutrientId: nutrientDefinition.nutrient_id,
		nutrientName: nutrientDefinition.nutrient_name,
		nutrientNumber: nutrientDefinition.nutrient_number ?? "",
		unitName,
		nutrientType: record.nutrient_type,
		step,
		group: groupTitle,
		groupSort: group.sort_order,
		sort: record.sort_order,
		label,
		requiredForManualEntry: record.required_for_manual_entry,
	};
};

const sortDefinitions = (
	left: ManualEntryNutrientDefinition,
	right: ManualEntryNutrientDefinition,
) =>
	left.sort - right.sort || left.nutrientName.localeCompare(right.nutrientName);

const preferDefinition = (
	left: ManualEntryNutrientDefinition,
	right: ManualEntryNutrientDefinition,
) => {
	return (
		left.sort - right.sort ||
		left.groupSort - right.groupSort ||
		left.nutrientName.localeCompare(right.nutrientName) ||
		left.nutrientId - right.nutrientId
	);
};

export const dedupeManualEntryNutrients = (
	definitions: ManualEntryNutrientDefinition[],
) => {
	const deduped = new Map<string, ManualEntryNutrientDefinition>();

	for (const definition of definitions) {
		const dedupeKey =
			definition.dedupeKey || buildFallbackDedupeKey(definition);
		const existing = deduped.get(dedupeKey);
		if (!existing || preferDefinition(definition, existing) < 0) {
			deduped.set(dedupeKey, {
				...definition,
				dedupeKey,
			});
		}
	}

	return [...deduped.values()];
};

export const groupManualEntryNutrients = (
	definitions: ManualEntryNutrientDefinition[],
): ManualEntryNutrientGroupsByStep => {
	const grouped = new Map<string, ManualEntryNutrientDefinition[]>();

	for (const definition of dedupeManualEntryNutrients(definitions)) {
		const key = `${definition.step}:${definition.group}`;
		const group = grouped.get(key) ?? [];
		group.push(definition);
		grouped.set(key, group);
	}

	const groupsByStep: ManualEntryNutrientGroupsByStep = {
		macros: [],
		extended: [],
	};

	for (const [key, fields] of grouped.entries()) {
		const [step, title] = key.split(":") as [ManualEntryNutrientStep, string];
		groupsByStep[step].push({
			title,
			fields: fields.sort(sortDefinitions),
		});
	}

	for (const groups of Object.values(groupsByStep)) {
		groups.sort((left, right) => {
			const leftSort = left.fields[0]?.groupSort ?? Number.MAX_SAFE_INTEGER;
			const rightSort = right.fields[0]?.groupSort ?? Number.MAX_SAFE_INTEGER;
			return leftSort - rightSort || left.title.localeCompare(right.title);
		});
	}

	return groupsByStep;
};

export const readManualEntryNutrientGroups = async (
	supabase: SupabaseClient<Database> | null,
): Promise<ManualEntryNutrientGroupsByStep | null> => {
	if (!supabase) return null;

	const [
		{ data: fields, error: fieldsError },
		{ data: requiredNutrients, error: requiredNutrientsError },
	] = await Promise.all([
		supabase
			.from("nutrient_manual_entry_fields")
			.select(
				"nutrient_id, nutrient_type, group_id, display_label, required_for_manual_entry, sort_order, dedupe_key",
			)
			.eq("enabled", true)
			.eq("classification_status", "approved")
			.order("sort_order", { ascending: true }),
		supabase
			.from("nutrient_manual_entry_required_nutrients")
			.select("nutrient_id, group_id, field_sort_order")
			.eq("enabled", true)
			.order("field_sort_order", { ascending: true }),
	]);

	if (fieldsError || requiredNutrientsError) {
		if (import.meta.env.DEV) {
			console.error("Unable to load manual entry nutrient fields", {
				fieldsError,
				requiredNutrientsError,
			});
		}
		return null;
	}

	const rawFields = (fields ?? []) as RawManualEntryFieldRecord[];
	if (rawFields.length === 0) return null;
	const requiredRows = (requiredNutrients ??
		[]) as RequiredManualEntryNutrientRecord[];
	const requiredRowsByNutrientId = new Map(
		requiredRows.map((row) => [row.nutrient_id, row]),
	);
	const requiredGroupIds = requiredRows.map((row) => row.group_id);

	const groupIds = [
		...new Set([
			...rawFields.map((field) => field.group_id),
			...requiredGroupIds,
		]),
	];
	const nutrientIds = [...new Set(rawFields.map((field) => field.nutrient_id))];

	const [
		{ data: groups, error: groupsError },
		{ data: nutrients, error: nutrientsError },
	] = await Promise.all([
		supabase
			.from("nutrient_manual_entry_groups")
			.select("id, entry_step, title, sort_order")
			.in("id", groupIds)
			.eq("enabled", true)
			.eq("group_role", "display"),
		supabase
			.from("nutrient_definitions")
			.select("nutrient_id, nutrient_name, nutrient_number, default_unit_name")
			.in("nutrient_id", nutrientIds),
	]);

	if (groupsError || nutrientsError) {
		if (import.meta.env.DEV) {
			console.error("Unable to load manual entry nutrient metadata", {
				groupsError,
				nutrientsError,
			});
		}
		return null;
	}

	const groupsById = new Map(
		((groups ?? []) as ManualEntryGroupRecord[]).map((group) => [
			group.id,
			group,
		]),
	);
	const nutrientsById = new Map(
		((nutrients ?? []) as NutrientDefinitionRecord[]).map((nutrient) => [
			nutrient.nutrient_id,
			nutrient,
		]),
	);

	const definitions = rawFields
		.map((field): ManualEntryFieldRecord => {
			const requiredRow = requiredRowsByNutrientId.get(field.nutrient_id);
			return {
				...field,
				group_id: requiredRow?.group_id ?? field.group_id,
				sort_order: requiredRow?.field_sort_order ?? field.sort_order,
				required_for_manual_entry: Boolean(requiredRow),
				nutrient_definitions: nutrientsById.get(field.nutrient_id) ?? null,
				nutrient_manual_entry_groups:
					groupsById.get(requiredRow?.group_id ?? field.group_id) ?? null,
			};
		})
		.map(toManualEntryNutrientDefinition)
		.filter((definition): definition is ManualEntryNutrientDefinition =>
			Boolean(definition),
		);

	return definitions.length > 0 ? groupManualEntryNutrients(definitions) : null;
};
