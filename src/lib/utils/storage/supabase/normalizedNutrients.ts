import type { Database } from "$lib/types/database.types";
import type { NormalizedNutrientRow } from "$lib/utils/food/normalizedNutrients";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NormalizedNutrientParentColumn =
	| "user_food_list_item_id"
	| "custom_food_id"
	| "shared_product_id";

type FoodNutrientRecord = Pick<
	Database["public"]["Tables"]["food_nutrients"]["Row"],
	| "user_food_list_item_id"
	| "custom_food_id"
	| "shared_product_id"
	| "nutrient_id"
	| "amount_per_100g"
	| "unit_name"
	| "value_origin"
	| "source"
	| "source_reference"
	| "confidence"
>;
type NutrientDefinitionRecord = Pick<
	Database["public"]["Tables"]["nutrient_definitions"]["Row"],
	"nutrient_id" | "nutrient_name" | "nutrient_number" | "default_unit_name"
>;

const READ_CHUNK_SIZE = 100;

const chunkValues = <Value>(values: Value[]) => {
	const chunks: Value[][] = [];
	for (let index = 0; index < values.length; index += READ_CHUNK_SIZE) {
		chunks.push(values.slice(index, index + READ_CHUNK_SIZE));
	}
	return chunks;
};

const readParentId = (
	row: FoodNutrientRecord,
	parentColumn: NormalizedNutrientParentColumn,
) => row[parentColumn];

const readNutrientRows = async (
	supabase: SupabaseClient<Database>,
	parentColumn: NormalizedNutrientParentColumn,
	parentIds: string[],
) => {
	const rows: FoodNutrientRecord[] = [];

	for (const parentIdChunk of chunkValues(parentIds)) {
		const baseQuery = supabase.from("food_nutrients").select(
			"user_food_list_item_id, custom_food_id, shared_product_id, nutrient_id, amount_per_100g, unit_name, value_origin, source, source_reference, confidence",
		);
		const response =
			parentColumn === "user_food_list_item_id"
				? await baseQuery.in("user_food_list_item_id", parentIdChunk)
				: parentColumn === "custom_food_id"
					? await baseQuery.in("custom_food_id", parentIdChunk)
					: await baseQuery.in("shared_product_id", parentIdChunk);

		if (response.error) return null;
		rows.push(...(response.data as FoodNutrientRecord[]));
	}

	return rows;
};

const readNutrientDefinitions = async (
	supabase: SupabaseClient<Database>,
	nutrientIds: number[],
) => {
	const definitions = new Map<number, NutrientDefinitionRecord>();

	for (const nutrientIdChunk of chunkValues(nutrientIds)) {
		const { data, error } = await supabase
			.from("nutrient_definitions")
			.select("nutrient_id, nutrient_name, nutrient_number, default_unit_name")
			.in("nutrient_id", nutrientIdChunk);
		if (error) return null;
		for (const definition of data as NutrientDefinitionRecord[]) {
			definitions.set(definition.nutrient_id, definition);
		}
	}

	return definitions;
};

export const readNormalizedNutrientsByParent = async (
	supabase: SupabaseClient<Database>,
	parentColumn: NormalizedNutrientParentColumn,
	parentIds: string[],
): Promise<Map<string, NormalizedNutrientRow[]> | null> => {
	const uniqueParentIds = [...new Set(parentIds.filter(Boolean))];
	if (uniqueParentIds.length === 0) return new Map();

	const nutrientRows = await readNutrientRows(
		supabase,
		parentColumn,
		uniqueParentIds,
	);
	if (!nutrientRows) return null;
	if (nutrientRows.length === 0) return new Map();

	const nutrientIds = [
		...new Set(nutrientRows.map((row) => row.nutrient_id)),
	];
	const definitions = await readNutrientDefinitions(supabase, nutrientIds);
	if (!definitions) return null;

	const rowsByParent = new Map<string, NormalizedNutrientRow[]>();
	for (const row of nutrientRows) {
		const parentId = readParentId(row, parentColumn);
		const definition = definitions.get(row.nutrient_id);
		if (!parentId || !definition) continue;

		const normalizedRow: NormalizedNutrientRow = {
			nutrientId: row.nutrient_id,
			nutrientName: definition.nutrient_name,
			nutrientNumber: definition.nutrient_number,
			unitName: row.unit_name || definition.default_unit_name,
			value: row.amount_per_100g,
			valueOrigin: row.value_origin as NormalizedNutrientRow["valueOrigin"],
			source: row.source as NormalizedNutrientRow["source"],
			sourceReference: row.source_reference,
			confidence: row.confidence as NormalizedNutrientRow["confidence"],
		};
		const parentRows = rowsByParent.get(parentId) ?? [];
		parentRows.push(normalizedRow);
		rowsByParent.set(parentId, parentRows);
	}

	return rowsByParent;
};
