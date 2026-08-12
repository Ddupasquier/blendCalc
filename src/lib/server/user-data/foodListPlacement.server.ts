import { lookupBarcodeProductDraft } from "$lib/server/products/barcodeProduct.server";
import { createCatalogFoodFromDraft } from "$lib/server/products/catalogFood.server";
import { getUsdaFoodById } from "$lib/server/products/usdaCache.server";
import type { Database } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { isPrivateCustomFood } from "$lib/utils/food/records/foodClassification";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import {
	addFoodFieldEvidenceContext,
	enrichListFoodWithExactSourceEvidence,
} from "$lib/utils/food/records/exactSourceListEnrichment";
import type { FoodItem } from "$lib/utils/food/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const getFoodBarcode = (food: FoodItem) =>
	normalizeBarcode(food.barcode ?? food.gtinUpc ?? "");

const getResolvedDraftCategory = (
	draft: Awaited<ReturnType<typeof lookupBarcodeProductDraft>>,
) => draft?.categoryResolution
	? {
		categoryOptionId: draft.categoryResolution.categoryOptionId,
		label: draft.categoryResolution.label,
		sourceValue: draft.categoryResolution.sourceValue,
		confidence: draft.categoryResolution.confidence,
		symbolKey: draft.categoryResolution.symbolKey,
	}
	: undefined;

const enrichBarcodeFood = async (
	supabase: SupabaseClient<Database>,
	food: FoodItem,
	barcode: string,
) => {
	const draft = await lookupBarcodeProductDraft(supabase, barcode);
	if (!draft) return food;
	const sourceFood = addFoodFieldEvidenceContext(
		createCatalogFoodFromDraft(
			draft,
			getResolvedDraftCategory(draft),
			draft.source === "shared-catalog" ? draft.sourceReference : undefined,
		),
		{
			observedAt: draft.sourceModifiedDate ?? draft.sourcePublishedDate,
			verificationMethod: "exact-barcode",
			reviewState: draft.source === "shared-catalog" ? "accepted" : "unreviewed",
		},
	);
	return enrichListFoodWithExactSourceEvidence(food, sourceFood);
};

const enrichUsdaGenericFood = async (food: FoodItem) => {
	if (
		food.sourceKey !== "usda" ||
		!Number.isSafeInteger(food.fdcId) ||
		food.fdcId <= 0
	) {
		return food;
	}
	const detail = addFoodFieldEvidenceContext(
		await getUsdaFoodById(food.fdcId),
		{
			observedAt: food.sourceModifiedDate ?? food.sourcePublishedDate,
			verificationMethod: "exact-source-record",
			reviewState: "unreviewed",
		},
	);
	return enrichListFoodWithExactSourceEvidence(food, detail);
};

export const enrichFoodForListPlacement = async (
	supabase: SupabaseClient<Database>,
	food: FoodItem,
) => {
	try {
		if (isPrivateCustomFood(food)) return normalizeFoodForStorage(food);
		const barcode = getFoodBarcode(food);
		const enriched = barcode
			? await enrichBarcodeFood(supabase, food, barcode)
			: await enrichUsdaGenericFood(food);
		return normalizeFoodForStorage(enriched);
	} catch {
		return normalizeFoodForStorage(food);
	}
};
