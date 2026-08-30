import type { Database } from "$lib/types/database.types";
import type { NormalizedNutrientRow } from "$lib/utils/food/nutrients/normalizedNutrients";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDatabaseQueryAbortSignal } from "./databaseQueryAbortSignal";

export type NormalizedNutrientParentColumn =
	"user_food_list_item_id" | "custom_food_id" | "shared_product_id";

type FoodNutrientRecord = Pick<
	Database["public"]["Tables"]["food_nutrients"]["Row"],
	| "user_food_list_item_id"
	| "custom_food_id"
	| "shared_product_id"
	| "nutrient_id"
	| "amount_per_100g"
	| "unit_name"
	| "value_origin"
	| "value_qualifier"
	| "source"
	| "source_reference"
	| "confidence"
	| "value_status"
	| "standard_error"
	| "source_nutrient_key"
	| "source_nutrient_code"
	| "mapping_status"
	| "mapping_method"
	| "mapping_review_reference"
	| "derivation_method"
>;
type NutrientDefinitionRecord = Pick<
	Database["public"]["Tables"]["nutrient_definitions"]["Row"],
	"nutrient_id" | "nutrient_name" | "nutrient_number" | "default_unit_name"
>;
type FoodNutrientRecordWithDefinition = FoodNutrientRecord & {
	nutrient_definitions: NutrientDefinitionRecord | null;
};

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
	databaseAbortSignal?: AbortSignal,
) => {
	const rows: FoodNutrientRecordWithDefinition[] = [];

	for (const parentIdChunk of chunkValues(parentIds)) {
		const baseQuery = supabase
			.from("food_nutrients")
			.select(
				"user_food_list_item_id, custom_food_id, shared_product_id, nutrient_id, amount_per_100g, unit_name, value_origin, value_qualifier, source, source_reference, confidence, value_status, standard_error, source_nutrient_key, source_nutrient_code, mapping_status, mapping_method, mapping_review_reference, derivation_method, nutrient_definitions(nutrient_id, nutrient_name, nutrient_number, default_unit_name)",
			);
		const databaseQuery =
			parentColumn === "user_food_list_item_id"
				? baseQuery.in("user_food_list_item_id", parentIdChunk)
				: parentColumn === "custom_food_id"
					? baseQuery.in("custom_food_id", parentIdChunk)
					: baseQuery.in("shared_product_id", parentIdChunk);
		const response = await applyDatabaseQueryAbortSignal(
			databaseQuery,
			databaseAbortSignal,
		);

		if (response.error) throw response.error;
		rows.push(...(response.data as FoodNutrientRecordWithDefinition[]));
	}

	return rows;
};

export const readNormalizedNutrientsByParent = async (
	supabase: SupabaseClient<Database>,
	parentColumn: NormalizedNutrientParentColumn,
	parentIds: string[],
	databaseAbortSignal?: AbortSignal,
): Promise<Map<string, NormalizedNutrientRow[]>> => {
	const uniqueParentIds = [...new Set(parentIds.filter(Boolean))];
	if (uniqueParentIds.length === 0) return new Map();

	const nutrientRows = await readNutrientRows(
		supabase,
		parentColumn,
		uniqueParentIds,
		databaseAbortSignal,
	);
	if (nutrientRows.length === 0) return new Map();

	const rowsByParent = new Map<string, NormalizedNutrientRow[]>();
	for (const row of nutrientRows) {
		const parentId = readParentId(row, parentColumn);
		const definition = row.nutrient_definitions;
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
			valueStatus: row.value_status as NormalizedNutrientRow["valueStatus"],
			valueQualifier:
				row.value_qualifier as NormalizedNutrientRow["valueQualifier"],
			standardError: row.standard_error,
			sourceNutrientKey: row.source_nutrient_key,
			sourceNutrientCode: row.source_nutrient_code,
			mappingStatus:
				row.mapping_status as NormalizedNutrientRow["mappingStatus"],
			mappingMethod: row.mapping_method,
			mappingReviewReference: row.mapping_review_reference,
			derivationMethod: row.derivation_method,
		};
		const parentRows = rowsByParent.get(parentId) ?? [];
		parentRows.push(normalizedRow);
		rowsByParent.set(parentId, parentRows);
	}

	return rowsByParent;
};
