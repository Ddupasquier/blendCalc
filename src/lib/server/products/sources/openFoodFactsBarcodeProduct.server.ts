import { APP_USER_AGENT } from "$lib/config/brand";
import { fetchCachedProductApiJson } from "$lib/server/products/productApiRequests.server";
import { getProductReferenceCatalog } from "$lib/server/products/productReferenceCatalog.server";
import {
	createProductSourceRequestTrace,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	getOpenFoodFactsRequestBarcode,
	getOpenFoodFactsRequestedFields,
} from "$lib/server/products/sources/openFoodFactsRequestPolicy";
import {
	getBarcodeProductDesiredSourceFieldPaths,
	type ProductSourceFieldPath,
} from "$lib/utils/barcode/barcodeProductEnrichment";
import {
	mapOpenFoodFactsProduct,
	type BarcodeProductDraft,
	type OpenFoodFactsResponse,
} from "$lib/utils/barcode/barcodeProductMappers";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v3.6/product";
const OPEN_FOOD_FACTS_CACHE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_NOT_FOUND_CACHE_MILLISECONDS = 12 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_STALE_FALLBACK_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_REQUEST_COORDINATION = {
	maxRequestsPerWindow: 12,
	windowMilliseconds: 60_000,
	leaseMilliseconds: 12_000,
	waitForRefreshMilliseconds: 9_000,
} as const;

export const lookupOpenFoodFactsBarcodeProduct = async (
	barcode: string,
	productReferenceCatalog?: ProductReferenceCatalog,
	requestedFieldPaths: readonly ProductSourceFieldPath[] = getBarcodeProductDesiredSourceFieldPaths(),
	options: { cacheOnly?: boolean } = {},
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	const requestBarcode = getOpenFoodFactsRequestBarcode(barcode);
	if (!canonicalBarcode || !requestBarcode) return null;
	const requestedFields = getOpenFoodFactsRequestedFields(requestedFieldPaths);
	const requestedFieldsValue = requestedFields.join(",");
	const startedAt = Date.now();
	const trace = createProductSourceRequestTrace();

	try {
		const url = new URL(
			`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(requestBarcode)}.json`,
		);
		url.searchParams.set("fields", requestedFieldsValue);
		const data = await fetchCachedProductApiJson<OpenFoodFactsResponse | null>({
			provider: "open-food-facts",
			requestKind: "barcode-product",
			cacheValue: {
				apiVersion: "3.6",
				barcode: requestBarcode,
				fields: requestedFields,
			},
			url,
			headers: {
				accept: "application/json",
				"user-agent": APP_USER_AGENT,
			},
			ttlMilliseconds: OPEN_FOOD_FACTS_CACHE_MILLISECONDS,
			notFoundTtlMilliseconds: OPEN_FOOD_FACTS_NOT_FOUND_CACHE_MILLISECONDS,
			staleIfErrorMilliseconds: OPEN_FOOD_FACTS_STALE_FALLBACK_MILLISECONDS,
			notFoundStatusCodes: [404],
			notFoundValue: null,
			trace,
			maxAttempts: 1,
			coordination: OPEN_FOOD_FACTS_REQUEST_COORDINATION,
			cacheOnly: options.cacheOnly,
		});
		if (!data?.product) return null;
		const matchedBarcode = normalizeBarcode(
			data.product.code ?? requestBarcode,
		);
		if (matchedBarcode !== canonicalBarcode) return null;
		const draft = mapOpenFoodFactsProduct(
			data.product,
			matchedBarcode,
			productReferenceCatalog ?? (await getProductReferenceCatalog()),
		);
		if (draft) {
			await recordProductSourceLookup({
				sourceKey: "open-food-facts",
				lookupKind: "barcode",
				outcome: "matched",
				startedAt,
				trace,
				quality: summarizeBarcodeProductQuality(draft),
				exactBarcodeMatch: true,
			});
			return draft;
		}

		await recordProductSourceLookup({
			sourceKey: "open-food-facts",
			lookupKind: "barcode",
			outcome: "not-found",
			startedAt,
			trace,
		});
		return null;
	} catch (error) {
		await recordProductSourceLookup({
			sourceKey: "open-food-facts",
			lookupKind: "barcode",
			outcome: "error",
			startedAt,
			trace,
		});
		throw error;
	}
};
