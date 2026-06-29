import { getSupabaseBrowserClient } from "$lib/supabase/client";
import type { Database } from "$lib/types/database.types";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
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
	| "sort_order"
	| "dedupe_key"
> & {
	nutrient_definitions: NutrientDefinitionRecord | null;
	nutrient_manual_entry_groups: ManualEntryGroupRecord | null;
};

const EMPTY_GROUPS: ManualEntryNutrientGroupsByStep = {
	macros: [],
	extended: [],
};

const UNIT_LABELS: Record<string, string> = {
	G: "g",
	MG: "mg",
	UG: "mcg",
	MCG: "mcg",
	KCAL: "kcal",
	IU: "IU",
};

const toDisplayUnit = (unitName: string) => {
	const normalizedUnit = unitName.trim().toUpperCase();
	return UNIT_LABELS[normalizedUnit] ?? normalizedUnit.toLowerCase();
};

const CORE_NUTRIENT_PRIORITY = new Map<number, number>([
	[NUTRIENT_IDS.CALORIES, 0],
	[NUTRIENT_IDS.FAT, 0],
	[NUTRIENT_IDS.CARBS, 0],
	[NUTRIENT_IDS.PROTEIN, 0],
	[NUTRIENT_IDS.FIBER, 0],
	[NUTRIENT_IDS.SUGAR, 0],
]);

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
	[step, normalizeDedupePart(group), normalizeDedupePart(label), toDisplayUnit(unitName)]
		.filter(Boolean)
		.join(":");

export const formatNutrientDefinitionLabel = (
	nutrientName: string,
	unitName: string,
) => {
	const displayUnit = toDisplayUnit(unitName);
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
	};
};

const sortDefinitions = (
	left: ManualEntryNutrientDefinition,
	right: ManualEntryNutrientDefinition,
) => left.sort - right.sort || left.nutrientName.localeCompare(right.nutrientName);

const preferDefinition = (
	left: ManualEntryNutrientDefinition,
	right: ManualEntryNutrientDefinition,
) => {
	const leftCorePriority = CORE_NUTRIENT_PRIORITY.get(left.nutrientId) ?? 1;
	const rightCorePriority = CORE_NUTRIENT_PRIORITY.get(right.nutrientId) ?? 1;
	return (
		leftCorePriority - rightCorePriority ||
		left.sort - right.sort ||
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
	supabase: SupabaseClient<Database> | null = getSupabaseBrowserClient(),
): Promise<ManualEntryNutrientGroupsByStep | null> => {
	if (!supabase) return null;

	const { data, error } = await supabase
		.from("nutrient_manual_entry_fields")
		.select(
			"nutrient_id, nutrient_type, group_id, display_label, sort_order, dedupe_key, nutrient_definitions(nutrient_id, nutrient_name, nutrient_number, default_unit_name), nutrient_manual_entry_groups!inner(id, entry_step, title, sort_order)",
		)
		.eq("enabled", true)
		.eq("nutrient_manual_entry_groups.enabled", true)
		.order("sort_order", { ascending: true });

	if (error) {
		if (import.meta.env.DEV) {
			console.error("Unable to load manual entry nutrient groups", error);
		}
		return null;
	}

	const definitions = (data as ManualEntryFieldRecord[])
		.map(toManualEntryNutrientDefinition)
		.filter((definition): definition is ManualEntryNutrientDefinition => Boolean(definition));

	return definitions.length > 0 ? groupManualEntryNutrients(definitions) : EMPTY_GROUPS;
};
