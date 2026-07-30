import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Json } from "$lib/types/database.types";

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
};

export const readCatalogProvenanceReviewRecord = async (
	sharedProductId: string,
): Promise<CatalogProvenanceReviewRecord | null> => {
	const admin = getSupabaseAdminClient();
	const [productResponse, provenanceResponse] = await Promise.all([
		admin
			.from("shared_products")
			.select("id, barcode, product_name")
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
	]);

	if (productResponse.error) throw productResponse.error;
	if (provenanceResponse.error) throw provenanceResponse.error;
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
	};
};
