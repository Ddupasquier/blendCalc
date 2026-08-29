import { createHash } from "node:crypto";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { toJson } from "$lib/utils/storage/supabase/shared";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import { createCatalogFoodFromDraft } from "./catalogFood.server";

const createObservationHash = (input: {
	barcode: string;
	source: string;
	sourceReference: string | null;
	normalizedFood: unknown;
}) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

export const persistLegallyStorableExactProductObservation = async (input: {
	draft: BarcodeProductDraft;
	providerKey: string;
	productReferenceCatalog: ProductReferenceCatalog;
}) => {
	const source = input.productReferenceCatalog.sources[input.providerKey];
	if (!source?.canonicalStorageAllowed || !source.canonicalLicenseName) return;
	const canonicalLicenseName = source.canonicalLicenseName;
	const normalizedFood = normalizeFoodForStorage(
		createCatalogFoodFromDraft(input.draft),
	);
	const sourceReference = input.draft.sourceReference?.trim() || null;
	const contentHash = createObservationHash({
		barcode: input.draft.barcode,
		source: input.providerKey,
		sourceReference,
		normalizedFood,
	});

	await completeServerBackgroundTask(
		(async () => {
			const adminClient = getSupabaseAdminClient();
			const { data: existing, error: readError } = await adminClient
				.from("shared_product_observations")
				.select("id")
				.eq("barcode", input.draft.barcode)
				.eq("source", input.providerKey)
				.eq("content_hash", contentHash)
				.maybeSingle();
			if (readError) throw readError;
			if (existing) return;

			const { error: insertError } = await adminClient
				.from("shared_product_observations")
				.insert({
					barcode: input.draft.barcode,
					source: input.providerKey,
					source_reference: sourceReference,
					source_license: canonicalLicenseName,
					raw_payload: toJson({
						providerKey: input.providerKey,
						sourceReference,
						draft: input.draft,
					}),
					normalized_food: toJson(normalizedFood),
					content_hash: contentHash,
				});
			if (insertError) throw insertError;
		})().catch((error) => {
			console.warn(
				`Unable to retain ${input.providerKey} exact-product observation:`,
				error instanceof Error ? error.message : error,
			);
		}),
	);
};
