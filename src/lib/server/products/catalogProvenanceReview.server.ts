import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database, Json } from "$lib/types/database.types";

type ProvenanceObservationRow = {
	id: string;
	source: string;
	source_reference: string | null;
	source_license: string;
	observed_at: string;
	created_at: string;
	expires_at: string | null;
};

type ProvenanceFieldRow = {
	id: string;
	field_path: string;
	source_value: Json;
	normalized_value: Json;
	confidence: string;
	verification_method: string;
	selected: boolean;
	created_at: string;
	shared_product_observations:
		| ProvenanceObservationRow
		| ProvenanceObservationRow[]
		| null;
};

export type CatalogProvenanceReviewRecord = {
	product: {
		id: string;
		barcode: string;
		name: string;
	};
	fields: Array<{
		id: string;
		fieldPath: string;
		sourceValue: Json;
		normalizedValue: Json;
		confidence: string;
		verificationMethod: string;
		selected: boolean;
		createdAt: string;
		observation: {
			id: string;
			source: string;
			sourceReference: string | null;
			sourceLicense: string;
			observedAt: string;
			createdAt: string;
			expiresAt: string | null;
		};
	}>;
	nutrients: Array<{
		nutrientId: number;
		nutrientName: string;
		amountPer100g: number;
		unitName: string;
		valueStatus: string;
		standardError: number | null;
		source: string;
		sourceReference: string | null;
		sourceObservationId: string | null;
		sourceNutrientKey: string | null;
		sourceNutrientCode: string | null;
		mappingStatus: string;
		mappingMethod: string | null;
		mappingReviewReference: string | null;
		derivationMethod: string | null;
	}>;
	sourceNutrientReview: Json[];
};

type NutrientReviewRow = Pick<
	Database["public"]["Tables"]["food_nutrients"]["Row"],
	| "nutrient_id"
	| "amount_per_100g"
	| "unit_name"
	| "value_status"
	| "standard_error"
	| "source"
	| "source_reference"
	| "source_observation_id"
	| "source_nutrient_key"
	| "source_nutrient_code"
	| "mapping_status"
	| "mapping_method"
	| "mapping_review_reference"
	| "derivation_method"
> & {
	nutrient_definitions: { nutrient_name: string } | null;
};

const readSourceNutrientReview = (food: Json): Json[] => {
	if (!food || Array.isArray(food) || typeof food !== "object") return [];
	const review = (food as Record<string, Json | undefined>).nutrientSourceReview;
	return Array.isArray(review) ? review : [];
};

export const readCatalogProvenanceReviewRecord = async (
	sharedProductId: string,
): Promise<CatalogProvenanceReviewRecord | null> => {
	const admin = getSupabaseAdminClient();
	const [productResponse, provenanceResponse, nutrientResponse] = await Promise.all([
		admin
			.from("shared_products")
			.select("id, barcode, product_name, food")
			.eq("id", sharedProductId)
			.eq("status", "active")
			.maybeSingle(),
		admin
			.from("shared_product_field_provenance")
			.select(
				"id, field_path, source_value, normalized_value, confidence, verification_method, selected, created_at, shared_product_observations(id, source, source_reference, source_license, observed_at, created_at, expires_at)",
			)
			.eq("shared_product_id", sharedProductId)
			.order("field_path", { ascending: true })
			.order("selected", { ascending: false }),
		admin
			.from("food_nutrients")
			.select(
				"nutrient_id, amount_per_100g, unit_name, value_status, standard_error, source, source_reference, source_observation_id, source_nutrient_key, source_nutrient_code, mapping_status, mapping_method, mapping_review_reference, derivation_method, nutrient_definitions(nutrient_name)",
			)
			.eq("shared_product_id", sharedProductId)
			.order("nutrient_id", { ascending: true }),
	]);

	if (productResponse.error) throw productResponse.error;
	if (provenanceResponse.error) throw provenanceResponse.error;
	if (nutrientResponse.error) throw nutrientResponse.error;
	if (!productResponse.data) return null;

	const fields = ((provenanceResponse.data ?? []) as ProvenanceFieldRow[])
		.flatMap((row) => {
			const observation = Array.isArray(row.shared_product_observations)
				? row.shared_product_observations[0]
				: row.shared_product_observations;
			if (!observation) return [];

			return [{
				id: row.id,
				fieldPath: row.field_path,
				sourceValue: row.source_value,
				normalizedValue: row.normalized_value,
				confidence: row.confidence,
				verificationMethod: row.verification_method,
				selected: row.selected,
				createdAt: row.created_at,
				observation: {
					id: observation.id,
					source: observation.source,
					sourceReference: observation.source_reference,
					sourceLicense: observation.source_license,
					observedAt: observation.observed_at,
					createdAt: observation.created_at,
					expiresAt: observation.expires_at,
				},
			}];
		});

	return {
		product: {
			id: productResponse.data.id,
			barcode: productResponse.data.barcode,
			name: productResponse.data.product_name,
		},
		fields,
		nutrients: ((nutrientResponse.data ?? []) as NutrientReviewRow[]).map(
			(row) => ({
				nutrientId: row.nutrient_id,
				nutrientName:
					row.nutrient_definitions?.nutrient_name ??
					`Nutrient ${row.nutrient_id}`,
				amountPer100g: row.amount_per_100g,
				unitName: row.unit_name,
				valueStatus: row.value_status,
				standardError: row.standard_error,
				source: row.source,
				sourceReference: row.source_reference,
				sourceObservationId: row.source_observation_id,
				sourceNutrientKey: row.source_nutrient_key,
				sourceNutrientCode: row.source_nutrient_code,
				mappingStatus: row.mapping_status,
				mappingMethod: row.mapping_method,
				mappingReviewReference: row.mapping_review_reference,
				derivationMethod: row.derivation_method,
			}),
		),
		sourceNutrientReview: readSourceNutrientReview(productResponse.data.food),
	};
};
