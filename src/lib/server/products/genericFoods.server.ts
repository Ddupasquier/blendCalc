import type { Database, Json } from "$lib/types/database.types";
import { parseSourceServingMeasure } from "$lib/utils/serving/servingAmount";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";
import type {
	FdcFood,
	FdcNutrient,
	FoodNutrientSourceReview,
	FoodNutrientValueQualifier,
	FoodNutrientValueStatus,
	FoodServing,
} from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const GENERIC_FOOD_SEARCH_LIMIT = 100;
type GenericFoodSource = NonNullable<FdcNutrient["source"]>;

type GenericNutrientRow = {
	nutrientId: number | string | null;
	nutrientNumber?: string | null;
	nutrientName: string;
	unitName: string;
	value: number | string | null;
	standardError?: number | string | null;
	sourceNutrientKey?: string | null;
	sourceNutrientCode?: string | null;
	mappingStatus?: string | null;
	valueStatus?: string | null;
	mappingMethod?: string | null;
	mappingReviewReference?: string | null;
	sourceUpdatedAt?: string | null;
	metadata?: Json;
};

type GenericMeasureRow = {
	sourceMeasureKey: string;
	measureType: string;
	description: string;
	gramWeight: number | string;
	sourceUpdatedAt?: string | null;
};

type GenericSourceIdentifierRow = {
	sourceKey: string;
	identifierType: string;
	identifierValue: string;
};

type GenericFoodSearchRow = {
	application_food_id: number | string;
	dataset_key: string;
	source_food_key: string;
	description: string;
	alternate_description: string | null;
	food_group_name: string | null;
	scientific_name: string | null;
	preparation: string | null;
	external_reference: string | null;
	source_updated_at: string | null;
	source_key: string;
	source_display_name: string;
	dataset_display_name: string;
	dataset_version: string;
	source_url: string;
	license_name: string;
	license_url: string;
	attribution_text: string;
	metadata: Json;
	source_identifiers: Json;
	nutrients: Json;
	measures: Json;
};

const asRecordArray = <Row>(value: Json): Row[] =>
	Array.isArray(value) ? (value as unknown as Row[]) : [];

const createSourceReference = (datasetKey: string, sourceFoodKey: string) =>
	`${datasetKey}:${sourceFoodKey}`;

const getApplicationIdentifierKey = (
	identifier: GenericSourceIdentifierRow,
) => {
	if (
		identifier.sourceKey === "usda" &&
		identifier.identifierType === "ndb-number"
	) {
		return "usdaNdbNumber";
	}
	if (
		identifier.sourceKey === "usda" &&
		identifier.identifierType === "fdc-id"
	) {
		return "usdaFdcId";
	}
	return `${identifier.sourceKey}:${identifier.identifierType}`;
};

const mapSourceIdentifiers = (
	rows: GenericSourceIdentifierRow[],
	sourceReference: string,
) =>
	Object.fromEntries([
		["datasetFoodKey", sourceReference],
		...rows.flatMap((identifier) => {
			const value = identifier.identifierValue?.trim();
			return value
				? [[getApplicationIdentifierKey(identifier), value] as const]
				: [];
		}),
	]);

const mapNutrients = (
	rows: GenericNutrientRow[],
	sourceKey: GenericFoodSource,
	sourceReference: string,
): FdcNutrient[] =>
	rows.flatMap((row) => {
		if (row.mappingStatus !== "canonical" || row.valueStatus !== "measured") {
			return [];
		}
		const nutrientId = Number(row.nutrientId);
		const value = Number(row.value);
		if (
			row.nutrientId === null ||
			row.value === null ||
			!Number.isSafeInteger(nutrientId) ||
			!Number.isFinite(value)
		)
			return [];
		const standardError =
			row.standardError === null || row.standardError === undefined
				? undefined
				: Number(row.standardError);
		const valueQualifier = getGenericValueQualifier(row);
		return [
			{
				nutrientId,
				nutrientNumber: String(row.nutrientNumber),
				nutrientName: row.nutrientName,
				unitName: row.unitName,
				value,
				valueOrigin:
					valueQualifier === "source-estimate"
						? ("estimated" as const)
						: ("reported" as const),
				valueStatus:
					valueQualifier === "source-estimate"
						? ("estimated" as const)
						: value === 0
							? ("reported-zero" as const)
							: ("reported" as const),
				...(valueQualifier ? { valueQualifier } : {}),
				standardError:
					Number.isFinite(standardError) && Number(standardError) >= 0
						? standardError
						: undefined,
				sourceNutrientKey: row.sourceNutrientKey?.trim() || undefined,
				sourceNutrientCode: row.sourceNutrientCode?.trim() || undefined,
				mappingStatus: "canonical" as const,
				mappingMethod: row.mappingMethod?.trim() || undefined,
				mappingReviewReference: row.mappingReviewReference?.trim() || undefined,
				source: sourceKey,
				sourceReference,
				confidence: "imported" as const,
			},
		];
	});

const getGenericValueQualifier = (
	row: GenericNutrientRow,
): FoodNutrientValueQualifier | undefined => {
	if (
		row.metadata &&
		!Array.isArray(row.metadata) &&
		typeof row.metadata === "object" &&
		row.metadata.valueQualifier === "source-estimate"
	) {
		return "source-estimate";
	}
	return undefined;
};

const mapGenericValueStatus = (
	row: GenericNutrientRow,
): FoodNutrientValueStatus => {
	if (row.valueStatus === "measured") {
		if (getGenericValueQualifier(row) === "source-estimate") return "estimated";
		return Number(row.value) === 0 ? "reported-zero" : "reported";
	}
	if (
		row.valueStatus === "trace" ||
		row.valueStatus === "present-unquantified" ||
		row.valueStatus === "missing" ||
		row.valueStatus === "invalid"
	) {
		return row.valueStatus;
	}
	return "unknown";
};

const mapNutrientSourceReview = (
	rows: GenericNutrientRow[],
	sourceKey: GenericFoodSource,
	sourceReference: string,
): FoodNutrientSourceReview[] =>
	rows.map((row) => {
		const nutrientId = Number(row.nutrientId);
		const amountPer100g = row.value === null ? Number.NaN : Number(row.value);
		const standardError =
			row.standardError === null || row.standardError === undefined
				? Number.NaN
				: Number(row.standardError);
		return {
			...(Number.isSafeInteger(nutrientId) && nutrientId > 0
				? { nutrientId }
				: {}),
			nutrientName:
				row.nutrientName?.trim() ||
				row.sourceNutrientKey?.trim() ||
				"Unmapped source nutrient",
			...(row.unitName?.trim() ? { unitName: row.unitName.trim() } : {}),
			...(Number.isFinite(amountPer100g) && amountPer100g >= 0
				? { amountPer100g }
				: {}),
			...(Number.isFinite(standardError) && standardError >= 0
				? { standardError }
				: {}),
			...(row.sourceNutrientKey?.trim()
				? { sourceNutrientKey: row.sourceNutrientKey.trim() }
				: {}),
			...(row.sourceNutrientCode?.trim()
				? { sourceNutrientCode: row.sourceNutrientCode.trim() }
				: {}),
			valueStatus: mapGenericValueStatus(row),
			...(getGenericValueQualifier(row)
				? { valueQualifier: getGenericValueQualifier(row) }
				: {}),
			mappingStatus:
				row.mappingStatus === "canonical" ||
				row.mappingStatus === "unmapped" ||
				row.mappingStatus === "excluded"
					? row.mappingStatus
					: "unknown",
			...(row.mappingMethod?.trim()
				? { mappingMethod: row.mappingMethod.trim() }
				: {}),
			...(row.mappingReviewReference?.trim()
				? { mappingReviewReference: row.mappingReviewReference.trim() }
				: {}),
			source: sourceKey,
			sourceReference,
		};
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
		const parsed = parseSourceServingMeasure(label);
		return [
			{
				label,
				gramWeight,
				amount: parsed?.quantity,
				unitKey: parsed?.unit,
				isPrimary: index === 0,
				measureType: row.measureType?.trim() || undefined,
				isHouseholdMeasure: true,
				sourceMeasureKey: row.sourceMeasureKey?.trim() || undefined,
				origin: "source-household-measure" as const,
				gramWeightMethod: "source-reported" as const,
				source: sourceKey,
				sourceReference,
				confidence: "imported" as const,
			},
		];
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

	return ((data ?? []) as unknown as GenericFoodSearchRow[]).map((row) => {
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
		const nutrientSourceReview = mapNutrientSourceReview(
			asRecordArray<GenericNutrientRow>(row.nutrients),
			sourceKey,
			sourceReference,
		);
		const foodServings = mapServings(
			asRecordArray<GenericMeasureRow>(row.measures),
			sourceKey,
			sourceReference,
		);
		const sourceIdentifiers = mapSourceIdentifiers(
			asRecordArray<GenericSourceIdentifierRow>(row.source_identifiers),
			sourceReference,
		);

		return {
			fdcId: Number(row.application_food_id),
			description: formatSourceProductName(row.description),
			sourceIdentifiers,
			nameProvenance: "source",
			foodIdentityType: "generic",
			alternateDescription: row.alternate_description ?? undefined,
			scientificName: row.scientific_name ?? undefined,
			preparation: row.preparation ?? undefined,
			foodCategory: row.food_group_name ?? undefined,
			foodNutrients,
			nutrientSourceReview,
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

export const readGenericFoodByApplicationId = async (
	supabase: SupabaseClient<Database>,
	foodId: number,
) => {
	if (!Number.isSafeInteger(foodId) || foodId <= 0) return null;
	const { data, error } = await supabase
		.from("generic_food_records")
		.select("description")
		.eq("application_food_id", foodId)
		.maybeSingle();
	if (error) throw error;
	if (!data?.description) return null;

	const matches = await searchGenericFoods(supabase, data.description);
	return matches.find((food) => food.fdcId === foodId) ?? null;
};
