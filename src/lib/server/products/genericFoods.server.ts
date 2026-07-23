import type { Database, Json } from "$lib/types/database.types";
import { parseServingAmount } from "$lib/utils/serving/servingAmount";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import type {
	FdcFood,
	FdcNutrient,
	FoodServing,
} from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const GENERIC_FOOD_SEARCH_LIMIT = 100;
type GenericFoodSource = NonNullable<FdcNutrient["source"]>;

type GenericNutrientRow = {
	nutrientId: number | string;
	nutrientNumber: string;
	nutrientName: string;
	unitName: string;
	value: number | string;
	sourceUpdatedAt?: string | null;
};

type GenericMeasureRow = {
	sourceMeasureKey: string;
	description: string;
	gramWeight: number | string;
	sourceUpdatedAt?: string | null;
};

const asRecordArray = <Row>(value: Json): Row[] =>
	Array.isArray(value) ? value as unknown as Row[] : [];

const createSourceReference = (datasetKey: string, sourceFoodKey: string) =>
	`${datasetKey}:${sourceFoodKey}`;

const mapNutrients = (
	rows: GenericNutrientRow[],
	sourceKey: GenericFoodSource,
	sourceReference: string,
): FdcNutrient[] =>
	rows.flatMap((row) => {
		const nutrientId = Number(row.nutrientId);
		const value = Number(row.value);
		if (!Number.isSafeInteger(nutrientId) || !Number.isFinite(value)) return [];
		return [{
			nutrientId,
			nutrientNumber: String(row.nutrientNumber),
			nutrientName: row.nutrientName,
			unitName: row.unitName,
			value,
			valueOrigin: "reported" as const,
			source: sourceKey,
			sourceReference,
			confidence: "imported" as const,
		}];
	});

const mapServings = (
	rows: GenericMeasureRow[],
	sourceKey: GenericFoodSource,
	sourceReference: string,
): FoodServing[] =>
	rows.flatMap((row, index) => {
		const gramWeight = Number(row.gramWeight);
		const label = row.description?.trim();
		if (!label || !Number.isFinite(gramWeight) || gramWeight <= 0) return [];
		const parsed = parseServingAmount(label);
		return [{
			label,
			gramWeight,
			amount: parsed?.quantity,
			unitKey: parsed?.unit,
			isPrimary: index === 0,
			source: sourceKey,
			sourceReference,
			confidence: "imported" as const,
		}];
	});

export const searchGenericFoods = async (
	supabase: SupabaseClient<Database>,
	query: string,
): Promise<FdcFood[]> => {
	const { data, error } = await supabase.rpc("search_generic_food_records", {
		p_query: query,
		p_limit: GENERIC_FOOD_SEARCH_LIMIT,
	});
	if (error) throw error;

	return (data ?? []).map((row) => {
		const sourceReference = createSourceReference(
			row.dataset_key,
			row.source_food_key,
		);
		const sourceKey = row.source_key as GenericFoodSource;
		const foodNutrients = mapNutrients(
			asRecordArray<GenericNutrientRow>(row.nutrients),
			sourceKey,
			sourceReference,
		);
		const foodServings = mapServings(
			asRecordArray<GenericMeasureRow>(row.measures),
			sourceKey,
			sourceReference,
		);

		return {
			fdcId: Number(row.application_food_id),
			description: formatSourceProductName(row.description),
			nameProvenance: "source",
			foodCategory: row.food_group_name ?? undefined,
			foodNutrients,
			reportedNutrientIds: foodNutrients.map(({ nutrientId }) => nutrientId),
			dataType: "Generic",
			sourceKey: row.source_key,
			sourceLabel: row.source_display_name,
			sourceDataType: row.dataset_display_name,
			sourcePublishedDate: row.source_updated_at ?? undefined,
			sourceAttribution: {
				datasetKey: row.dataset_key,
				datasetName: row.dataset_display_name,
				datasetVersion: row.dataset_version,
				sourceName: row.source_display_name,
				sourceUrl: row.source_url,
				licenseName: row.license_name,
				licenseUrl: row.license_url,
				attributionText: row.attribution_text,
			},
			trustStatus: "imported",
			foodServings,
			hasSourceServing: foodServings.length > 0,
			fieldProvenance: {
				nutrition: {
					source: sourceKey,
					sourceReference,
					confidence: "imported",
				},
				...(foodServings.length > 0
					? {
						serving: {
							source: sourceKey,
							sourceReference,
							confidence: "imported" as const,
						},
					}
					: {}),
			},
		};
	});
};
