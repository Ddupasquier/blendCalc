import { createHash } from "node:crypto";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database } from "$lib/types/database.types";
import { toJson } from "$lib/utils/storage/supabase/shared";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import type { FoodItem } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCatalogFoodFromDraft } from "./catalogFood.server";

const RETAINED_EXACT_EVIDENCE_SOURCES = [
	"usda",
	"open-food-facts",
	"manufacturer",
	"gs1",
] as const;

export type RetainedExactProductObservation = {
	id: string;
	source: (typeof RETAINED_EXACT_EVIDENCE_SOURCES)[number];
	sourceReference: string;
	observedAt: string;
	food: FoodItem;
};

const isStoredFoodItem = (value: unknown): value is FoodItem =>
	Boolean(
		value &&
		typeof value === "object" &&
		typeof (value as Partial<FoodItem>).description === "string" &&
		Array.isArray((value as Partial<FoodItem>).foodNutrients),
	);

export const readRetainedExactProductObservations = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
): Promise<RetainedExactProductObservation[]> => {
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from("shared_product_observations")
		.select("id, source, source_reference, normalized_food, observed_at")
		.eq("barcode", barcode)
		.in("source", [...RETAINED_EXACT_EVIDENCE_SOURCES])
		.not("source_reference", "is", null)
		.not("normalized_food", "is", null)
		.or(`expires_at.is.null,expires_at.gt.${now}`)
		.order("observed_at", { ascending: false })
		.limit(50);
	if (error) throw error;

	return (data ?? []).flatMap((row): RetainedExactProductObservation[] => {
		if (
			!RETAINED_EXACT_EVIDENCE_SOURCES.includes(
				row.source as RetainedExactProductObservation["source"],
			) ||
			!row.source_reference ||
			!isStoredFoodItem(row.normalized_food)
		) {
			return [];
		}
		return [
			{
				id: row.id,
				source: row.source as RetainedExactProductObservation["source"],
				sourceReference: row.source_reference,
				observedAt: row.observed_at,
				food: normalizeFoodForStorage(row.normalized_food),
			},
		];
	});
};

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
