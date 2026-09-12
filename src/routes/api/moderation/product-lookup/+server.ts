import { requireModeratorApiAccess } from "$lib/server/moderation/moderationAccess.server";
import { createCatalogFoodFromDraft } from "$lib/server/products/catalogFood.server";
import {
	getSharedProductByBarcode,
	searchApprovedSharedProducts,
} from "$lib/server/products/catalog.server";
import {
	lookupOpenFoodFactsBarcodeProduct,
	lookupUsdaBarcodeProduct,
} from "$lib/server/products/externalProduct.server";
import { getProductReferenceCatalog } from "$lib/server/products/productReferenceCatalog.server";
import {
	searchUsdaBrandedFoods,
	searchUsdaFoods,
} from "$lib/server/products/usdaCache.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { normalizeFdcFood } from "$lib/utils/food/sources/fdc";
import type { FoodItem } from "$lib/utils/food/types";
import type {
	PrivilegedProductLookupResult,
	PrivilegedProductLookupScope,
} from "$lib/utils/moderation/privilegedProductLookup";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const RESULT_LIMIT = 20;

const getFoodIdentity = (food: FoodItem) =>
	food.sharedProductId ??
	food.sourceIdentifiers?.usda ??
	food.sourceIdentifiers?.[food.sourceKey ?? ""] ??
	String(food.fdcId);

const toStoredResult = (food: FoodItem): PrivilegedProductLookupResult => ({
	id: `stored:${getFoodIdentity(food)}`,
	scope: "stored",
	providerKey: food.sourceKey ?? "shared-catalog",
	providerLabel: "Stored in blendCalc",
	food,
});

const toLiveFood = (draft: BarcodeProductDraft) =>
	createCatalogFoodFromDraft(draft);

const toLiveDraftResult = (
	draft: BarcodeProductDraft,
): PrivilegedProductLookupResult => ({
	id: `live:${draft.source}:${draft.sourceReference ?? draft.barcode}`,
	scope: "live",
	providerKey: draft.source,
	providerLabel: draft.sourceLabel,
	food: toLiveFood(draft),
});

const toLiveUsdaResult = (food: FoodItem): PrivilegedProductLookupResult => ({
	id: `live:usda:${food.fdcId}`,
	scope: "live",
	providerKey: "usda",
	providerLabel: food.sourceLabel ?? "USDA FoodData Central",
	food,
});

const uniqueResults = (results: PrivilegedProductLookupResult[]) => {
	const seen = new Set<string>();
	return results.filter((result) => {
		const barcode = result.food.barcode ?? result.food.gtinUpc ?? "";
		const key = `${result.scope}:${result.providerKey}:${barcode}:${result.food.fdcId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const readStoredResults = async (query: string) => {
	const admin = getSupabaseAdminClient();
	const normalizedBarcode = normalizeBarcode(query);
	const [exactFood, searchResults] = await Promise.all([
		normalizedBarcode
			? getSharedProductByBarcode(admin, normalizedBarcode)
			: Promise.resolve(null),
		searchApprovedSharedProducts(admin, query),
	]);
	return uniqueResults(
		[...(exactFood ? [exactFood] : []), ...searchResults]
			.slice(0, RESULT_LIMIT)
			.map(toStoredResult),
	);
};

const readLiveResults = async (query: string) => {
	const normalizedBarcode = normalizeBarcode(query);
	if (normalizedBarcode) {
		const referenceCatalog = await getProductReferenceCatalog();
		const [usda, openFoodFacts] = await Promise.allSettled([
			lookupUsdaBarcodeProduct(normalizedBarcode, referenceCatalog),
			lookupOpenFoodFactsBarcodeProduct(normalizedBarcode, referenceCatalog),
		]);
		const drafts = [
			usda.status === "fulfilled" ? usda.value : null,
			openFoodFacts.status === "fulfilled" ? openFoodFacts.value : null,
		].filter((draft): draft is BarcodeProductDraft => Boolean(draft));
		return {
			results: drafts.map(toLiveDraftResult),
			note:
				usda.status === "rejected" || openFoodFacts.status === "rejected"
					? "At least one live provider could not complete this lookup. Available provider results are shown."
					: undefined,
		};
	}

	const brandedResponse = await searchUsdaBrandedFoods(query);
	const brandedFoods = (brandedResponse.foods ?? []).map((food) => ({
		...normalizeFdcFood(food),
		sourceKey: "usda",
		sourceLabel: "USDA FoodData Central",
		sourceDataType: food.dataType,
	}));
	const nameResults =
		brandedFoods.length > 0 ? brandedFoods : await searchUsdaFoods(query);
	return {
		results: nameResults.slice(0, RESULT_LIMIT).map(toLiveUsdaResult),
		note: "Name searches query USDA FoodData Central branded products first. Enter an exact UPC / GTIN to query packaged-product providers including Open Food Facts.",
	};
};

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireModeratorApiAccess(locals);
	const query = requireAppValue(
		url.searchParams.get("q")?.trim(),
		400,
		"INVALID_REQUEST",
	);
	if (query.length < 2) throwAppError(400, "INVALID_REQUEST");
	if (query.length > 120) {
		throwAppError(400, "SEARCH_QUERY_TOO_LONG", { maximum: 120 });
	}
	const scopeValue = url.searchParams.get("scope")?.trim() ?? "stored";
	if (scopeValue !== "stored" && scopeValue !== "live") {
		throwAppError(400, "SEARCH_FILTER_INVALID");
	}
	const scope: PrivilegedProductLookupScope =
		scopeValue === "live" ? "live" : "stored";

	try {
		if (scope === "stored") {
			return json({
				query,
				scope,
				results: await readStoredResults(query),
			});
		}
		const live = await readLiveResults(query);
		return json({ query, scope, ...live });
	} catch (error) {
		console.error("[privileged product lookup] Lookup failed", error);
		return throwAppError(503, "FOOD_SEARCH_UNAVAILABLE");
	}
};
