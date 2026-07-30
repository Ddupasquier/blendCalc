import { createHash } from "node:crypto";
import { completeServerBackgroundTask } from "$lib/server/runtime/backgroundTask.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database, Json } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";
import { compactFood } from "$lib/utils/food/records/foodRecords";
import type {
	FdcFood,
	FoodFieldSource,
	FoodTrackedField,
} from "$lib/utils/food/types";
import { createCatalogFoodFromDraft } from "./catalogFood.server";

const canPromoteSourceToCanonicalCatalog = (
	fieldSource: FoodFieldSource | undefined,
	referenceData: ProductReferenceData,
): fieldSource is FoodFieldSource & {
	source: "usda" | "open-food-facts";
	sourceReference: string;
} => Boolean(
	fieldSource &&
		fieldSource.sourceReference?.trim() &&
		(fieldSource.source === "usda" ||
			fieldSource.source === "open-food-facts") &&
		referenceData.sources[fieldSource.source]?.canonicalStorageAllowed &&
		referenceData.sources[fieldSource.source]?.canonicalLicenseName,
);

const getFieldValue = (
	draft: BarcodeProductDraft,
	field: FoodTrackedField,
): Json => {
	switch (field) {
		case "nutrition":
			return {
				nutrients: draft.nutrients,
				reportedNutrientIds: draft.reportedNutrientIds,
			} as unknown as Json;
		case "image":
			return (draft.image ?? null) as Json;
		case "categories":
			return {
				categories: draft.categories ?? [],
				resolvedCategory: draft.resolvedCategory ?? null,
				categoryResolution: draft.categoryResolution ?? null,
			} as Json;
			case "serving":
				return {
					label: draft.servingLabel,
					weightGrams: draft.servingWeightGrams,
					volumeEquivalent: draft.volumeEquivalent ?? null,
				} as Json;
			case "ingredients":
				return {
					ingredients: draft.ingredients ?? null,
					ingredientList: draft.ingredientList ?? [],
				} as unknown as Json;
			case "allergens":
				return (draft.allergens ?? []) as Json;
			case "traces":
				return (draft.traces ?? []) as Json;
			case "dietaryTags":
				return (draft.dietaryTags ?? []) as Json;
			case "labels":
				return (draft.labels ?? []) as Json;
			case "structuredIngredients":
				return (draft.structuredIngredients ?? []) as unknown as Json;
			case "ingredientAnalysis":
				return (draft.ingredientAnalysis ?? null) as unknown as Json;
			case "additives":
				return (draft.additives ?? []) as Json;
			case "package":
				return (draft.packageQuantity ?? null) as unknown as Json;
			case "sourceMetadata":
				return (draft.sourceMetadata ?? null) as unknown as Json;
		}
	};

const createContentHash = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

const getCanonicalEvidenceConfidence = (
	source: FoodFieldSource,
): "source-verified" | "moderator-reviewed" | "corroborated" | "imported" => {
	switch (source.confidence) {
		case "source-verified":
		case "moderator-reviewed":
		case "corroborated":
		case "imported":
			return source.confidence;
		default:
			return "imported";
	}
};

const preserveCanonicalIdentity = (
	currentFood: FdcFood,
	enrichedFood: FdcFood,
	sharedProductId: string,
): FdcFood => compactFood({
	...enrichedFood,
	fdcId: currentFood.fdcId,
	dataType: "Shared Product",
	foodIdentityType: "packaged",
	customFood: false,
	sharedProductId,
	sharedProductConfidence: currentFood.sharedProductConfidence,
	barcodeSource: currentFood.barcodeSource,
	sourceKey: currentFood.sourceKey,
	sourceLabel: currentFood.sourceLabel,
	sourceDataType: currentFood.sourceDataType,
	sourcePublishedDate: currentFood.sourcePublishedDate,
	sourceModifiedDate: currentFood.sourceModifiedDate,
});

export const persistSharedProductExternalEnrichment = async (input: {
	sharedProductId: string;
	barcode: string;
	currentFood: FdcFood;
	enrichedDraft: BarcodeProductDraft;
	fields: FoodTrackedField[];
	referenceData: ProductReferenceData;
}) => {
	const supportedFields = input.fields.filter((field) =>
		canPromoteSourceToCanonicalCatalog(
			input.enrichedDraft.fieldProvenance?.[field],
			input.referenceData,
		),
	);
	if (supportedFields.length === 0) return [];

	const category = input.enrichedDraft.categoryResolution
		? {
				categoryOptionId: input.enrichedDraft.categoryResolution.categoryOptionId,
				label: input.enrichedDraft.categoryResolution.label,
				sourceValue: input.enrichedDraft.categoryResolution.sourceValue,
				confidence: input.enrichedDraft.categoryResolution.confidence,
			}
		: undefined;
	const enrichedFood = preserveCanonicalIdentity(
		input.currentFood,
		createCatalogFoodFromDraft(
			input.enrichedDraft,
			category,
			input.sharedProductId,
		),
		input.sharedProductId,
	);
	const observedAt = new Date().toISOString();
	const observations = supportedFields.map((field) => {
		const source = input.enrichedDraft.fieldProvenance?.[field];
		if (
			!source ||
			!canPromoteSourceToCanonicalCatalog(source, input.referenceData)
		) {
			throw new Error(`Unsupported enrichment source for ${field}.`);
		}
		const sourceLicense =
			input.referenceData.sources[source.source]?.canonicalLicenseName;
		if (!sourceLicense) {
			throw new Error(`Canonical storage policy is missing for ${field}.`);
		}
		const value = getFieldValue(input.enrichedDraft, field);
		const rawPayload = {
			field,
			value,
			sourceReference: source.sourceReference ?? null,
		};
		return {
			key: field,
			trackedField: field,
			source: source.source,
			sourceReference: source.sourceReference ?? null,
			sourceLicense,
			rawPayload,
			contentHash: createContentHash({
				barcode: input.barcode,
				source: source.source,
				sourceReference: source.sourceReference ?? null,
				rawPayload,
			}),
			observedAt,
		};
	});
	const provenance = supportedFields.map((field) => {
		const source = input.enrichedDraft.fieldProvenance?.[field];
		if (!source) {
			throw new Error(`Explicit enrichment provenance is missing for ${field}.`);
		}
		return {
			fieldPath: field,
			observationKey: field,
			source: source?.source,
			sourceReference: source?.sourceReference ?? null,
			sourceValue: getFieldValue(input.enrichedDraft, field),
			normalizedValue: getFieldValue(input.enrichedDraft, field),
			confidence: getCanonicalEvidenceConfidence(source),
			verificationMethod: "exact-barcode",
		};
	});

	const task = Promise.resolve(getSupabaseAdminClient().rpc(
		"apply_shared_product_external_enrichment",
		{
			p_shared_product_id: input.sharedProductId,
			p_barcode: input.barcode,
			p_enriched_food: enrichedFood as unknown as Json,
			p_category_option_id: category?.categoryOptionId,
			p_candidate_fields: supportedFields,
			p_observations: observations as unknown as Json,
			p_provenance: provenance as unknown as Json,
		},
	)).then(({ data, error }) => {
		if (error) throw error;
		return data ?? [];
	});

	await completeServerBackgroundTask(
		task.then(() => undefined).catch((error) => {
			console.error("Canonical product enrichment failed.", error);
		}),
	);
};
