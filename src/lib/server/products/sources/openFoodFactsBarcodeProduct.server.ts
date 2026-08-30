import { APP_USER_AGENT } from "$lib/config/brand";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";
import { fetchCachedProductApiJson } from "$lib/server/products/productApiRequests.server";
import { getProductReferenceCatalog } from "$lib/server/products/productReferenceCatalog.server";
import {
	createProductSourceRequestTrace,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapOpenFoodFactsProduct,
	type BarcodeProductDraft,
	type OpenFoodFactsResponse,
} from "$lib/utils/barcode/barcodeProductMappers";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"ingredients",
	"ingredients_tags",
	"ingredients_analysis_tags",
	"ingredients_percent_analysis",
	"ingredients_percent_estimate",
	"ingredients_percent_known",
	"ingredients_percent_unknown",
	"allergens",
	"allergens_tags",
	"allergens_hierarchy",
	"allergens_lc",
	"traces",
	"traces_tags",
	"traces_hierarchy",
	"traces_lc",
	"traces_from_ingredients",
	"traces_from_user",
	"additives_tags",
	"labels",
	"labels_tags",
	"categories",
	"categories_tags",
	"categories_hierarchy",
	"food_groups",
	"food_groups_tags",
	"image_front_url",
	"image_front_small_url",
	"image_front_thumb_url",
	"image_url",
	"image_small_url",
	"image_thumb_url",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"quantity",
	"product_quantity",
	"product_quantity_unit",
	"lang",
	"languages_tags",
	"countries",
	"countries_tags",
	"created_t",
	"last_modified_t",
	"last_updated_t",
	"rev",
	"schema_version",
	"completeness",
	"data_quality_tags",
	"data_quality_errors_tags",
	"data_quality_warnings_tags",
	"obsolete",
	"obsolete_since_date",
	"tags_sources",
	"nutriments",
].join(",");
const OPEN_FOOD_FACTS_CACHE_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_NOT_FOUND_CACHE_MILLISECONDS = 12 * 60 * 60 * 1000;
const OPEN_FOOD_FACTS_STALE_FALLBACK_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

export const lookupOpenFoodFactsBarcodeProduct = async (
	barcode: string,
	productReferenceCatalog?: ProductReferenceCatalog,
): Promise<BarcodeProductDraft | null> => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;
	const startedAt = Date.now();
	const trace = createProductSourceRequestTrace();

	try {
		const candidateMatch = await findFirstBarcodeCandidateMatch(
			barcode,
			async (candidate) => {
				const url = new URL(
					`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(candidate)}.json`,
				);
				url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
				const data =
					await fetchCachedProductApiJson<OpenFoodFactsResponse | null>({
						provider: "open-food-facts",
						requestKind: "barcode-product",
						cacheValue: { candidate, fields: OPEN_FOOD_FACTS_FIELDS },
						url,
						headers: {
							accept: "application/json",
							"user-agent": APP_USER_AGENT,
						},
						ttlMilliseconds: OPEN_FOOD_FACTS_CACHE_MILLISECONDS,
						notFoundTtlMilliseconds:
							OPEN_FOOD_FACTS_NOT_FOUND_CACHE_MILLISECONDS,
						staleIfErrorMilliseconds:
							OPEN_FOOD_FACTS_STALE_FALLBACK_MILLISECONDS,
						notFoundStatusCodes: [404],
						notFoundValue: null,
						trace,
					});
				if (!data || data.status !== 1 || !data.product) return null;
				const candidateBarcode = normalizeBarcode(candidate);
				const matchedBarcode = normalizeBarcode(data.product.code ?? candidate);
				if (!candidateBarcode || matchedBarcode !== candidateBarcode) {
					return null;
				}
				return {
					draft: mapOpenFoodFactsProduct(
						data.product,
						matchedBarcode,
						productReferenceCatalog ?? (await getProductReferenceCatalog()),
					),
				};
			},
		);
		const draft = candidateMatch?.value.draft ?? null;
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
