import type { Database } from "$lib/types/database.types";
import type {
	FoodFieldProvenance,
	FoodFieldSource,
	FoodTrackedField,
} from "$lib/utils/food/types";
import {
	getCatalogFieldReviewState,
	getCatalogFieldVerificationMethod,
	type CatalogFieldReviewState,
	type CatalogFieldVerificationMethod,
} from "$lib/utils/products/catalogFieldProvenance";
import type { SupabaseClient } from "@supabase/supabase-js";

const FOOD_TRACKED_FIELD_PATHS = new Set<FoodTrackedField>([
	"productName",
	"brandOwner",
	"nutrition",
	"image",
	"categories",
	"serving",
	"ingredients",
	"allergens",
	"traces",
	"precautionaryStatements",
	"dietaryTags",
	"labels",
	"structuredIngredients",
	"ingredientAnalysis",
	"additives",
	"package",
	"sourceMetadata",
]);

type CatalogFieldProvenanceRow = {
	shared_product_id: string;
	field_path: string;
	confidence: string;
	verification_method: string;
	shared_product_observations:
		| {
				id: string;
				source: string;
				source_reference: string | null;
				observed_at: string;
		  }
		| Array<{
				id: string;
				source: string;
				source_reference: string | null;
				observed_at: string;
		  }>
		| null;
};

export type CatalogFieldSource = {
	observationId: string;
	source: string;
	sourceReference: string | null;
	confidence: string | null;
	observedAt: string;
	verificationMethod: CatalogFieldVerificationMethod | null;
	reviewState: CatalogFieldReviewState;
};

export const readSelectedCatalogFieldProvenance = async (
	supabase: SupabaseClient<Database>,
	productIds: string[],
) => {
	const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
	if (uniqueProductIds.length === 0) {
		return new Map<string, Record<string, CatalogFieldSource>>();
	}

	const { data, error } = await supabase
		.from("shared_product_field_provenance")
		.select(
			"shared_product_id, field_path, confidence, verification_method, shared_product_observations(id, source, source_reference, observed_at)",
		)
		.in("shared_product_id", uniqueProductIds)
		.eq("selected", true);
	if (error) throw error;

	const provenanceByProduct = new Map<
		string,
		Record<string, CatalogFieldSource>
	>();
	for (const row of (data ?? []) as CatalogFieldProvenanceRow[]) {
		const observation = Array.isArray(row.shared_product_observations)
			? row.shared_product_observations[0]
			: row.shared_product_observations;
		if (!observation) continue;
		const productProvenance = provenanceByProduct.get(row.shared_product_id) ?? {};
		productProvenance[row.field_path] = {
			observationId: observation.id,
			source: observation.source,
			sourceReference: observation.source_reference,
			confidence: row.confidence,
			observedAt: observation.observed_at,
			verificationMethod: getCatalogFieldVerificationMethod(
				row.verification_method,
				row.confidence,
			),
			reviewState: getCatalogFieldReviewState(row.confidence),
		};
		provenanceByProduct.set(row.shared_product_id, productProvenance);
	}
	return provenanceByProduct;
};

export const toFoodFieldProvenance = (
	fieldProvenance: Record<string, CatalogFieldSource>,
): FoodFieldProvenance =>
	Object.fromEntries(
		Object.entries(fieldProvenance).flatMap(([fieldPath, source]) =>
			FOOD_TRACKED_FIELD_PATHS.has(fieldPath as FoodTrackedField)
				? [
						[
							fieldPath,
								{
									source: source.source as FoodFieldSource["source"],
									sourceReference: source.sourceReference ?? undefined,
									confidence:
										source.confidence as FoodFieldSource["confidence"],
									observationId: source.observationId,
									observedAt: source.observedAt,
									verificationMethod: source.verificationMethod ?? undefined,
									reviewState: source.reviewState,
								},
						],
					]
				: [],
		),
	);
