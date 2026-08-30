import type { Database } from "$lib/types/database.types";
import type { NormalizedServingRow } from "$lib/utils/food/servings/normalizedServings";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FoodServingParentColumn =
	"user_food_list_item_id" | "custom_food_id" | "shared_product_id";

type FoodServingRecord = Pick<
	Database["public"]["Tables"]["food_servings"]["Row"],
	| "user_food_list_item_id"
	| "custom_food_id"
	| "shared_product_id"
	| "serving_order"
	| "label"
	| "gram_weight"
	| "milliliter_volume"
	| "amount"
	| "unit_key"
	| "is_primary"
	| "measure_type"
	| "is_household_measure"
	| "source_measure_key"
	| "origin"
	| "gram_weight_method"
	| "calculation_basis"
	| "source"
	| "source_reference"
	| "confidence"
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
	row: FoodServingRecord,
	parentColumn: FoodServingParentColumn,
) => row[parentColumn];

export const readFoodServingsByParent = async (
	supabase: SupabaseClient<Database>,
	parentColumn: FoodServingParentColumn,
	parentIds: string[],
): Promise<Map<string, NormalizedServingRow[]>> => {
	const uniqueParentIds = [...new Set(parentIds.filter(Boolean))];
	if (uniqueParentIds.length === 0) return new Map();
	const rows: FoodServingRecord[] = [];

	for (const parentIdChunk of chunkValues(uniqueParentIds)) {
		const baseQuery = supabase
			.from("food_servings")
			.select(
				"user_food_list_item_id, custom_food_id, shared_product_id, serving_order, label, gram_weight, milliliter_volume, amount, unit_key, is_primary, measure_type, is_household_measure, source_measure_key, origin, gram_weight_method, calculation_basis, source, source_reference, confidence",
			);
		const response =
			parentColumn === "user_food_list_item_id"
				? await baseQuery.in("user_food_list_item_id", parentIdChunk)
				: parentColumn === "custom_food_id"
					? await baseQuery.in("custom_food_id", parentIdChunk)
					: await baseQuery.in("shared_product_id", parentIdChunk);
		if (response.error) {
			if (
				response.error.code !== "42703" &&
				response.error.code !== "PGRST204"
			) {
				throw response.error;
			}
			const legacyQuery = supabase
				.from("food_servings")
				.select(
					"user_food_list_item_id, custom_food_id, shared_product_id, serving_order, label, gram_weight, amount, unit_key, is_primary, measure_type, is_household_measure, source_measure_key, origin, gram_weight_method, calculation_basis, source, source_reference, confidence",
				);
			const legacyResponse =
				parentColumn === "user_food_list_item_id"
					? await legacyQuery.in("user_food_list_item_id", parentIdChunk)
					: parentColumn === "custom_food_id"
						? await legacyQuery.in("custom_food_id", parentIdChunk)
						: await legacyQuery.in("shared_product_id", parentIdChunk);
			if (legacyResponse.error) throw legacyResponse.error;
			rows.push(
				...(legacyResponse.data.map((row) => ({
					...row,
					milliliter_volume: null,
				})) as FoodServingRecord[]),
			);
			continue;
		}
		rows.push(...(response.data as FoodServingRecord[]));
	}

	const rowsByParent = new Map<string, NormalizedServingRow[]>();
	for (const row of rows) {
		const parentId = readParentId(row, parentColumn);
		if (!parentId) continue;
		const parentRows = rowsByParent.get(parentId) ?? [];
		parentRows.push({
			servingOrder: row.serving_order,
			label: row.label,
			gramWeight: row.gram_weight === null ? null : Number(row.gram_weight),
			milliliterVolume:
				row.milliliter_volume === null ? null : Number(row.milliliter_volume),
			amount: row.amount === null ? null : Number(row.amount),
			unitKey: row.unit_key,
			isPrimary: row.is_primary,
			measureType: row.measure_type,
			isHouseholdMeasure: row.is_household_measure,
			sourceMeasureKey: row.source_measure_key,
			origin: row.origin as NormalizedServingRow["origin"],
			gramWeightMethod:
				row.gram_weight_method as NormalizedServingRow["gramWeightMethod"],
			calculationBasis: row.calculation_basis,
			source: row.source as NormalizedServingRow["source"],
			sourceReference: row.source_reference,
			confidence: row.confidence as NormalizedServingRow["confidence"],
		});
		rowsByParent.set(parentId, parentRows);
	}

	for (const parentRows of rowsByParent.values()) {
		parentRows.sort((left, right) => left.servingOrder - right.servingOrder);
	}
	return rowsByParent;
};
