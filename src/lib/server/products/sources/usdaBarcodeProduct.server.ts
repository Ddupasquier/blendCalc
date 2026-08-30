import { getProductReferenceCatalog } from "$lib/server/products/productReferenceCatalog.server";
import {
	createProductSourceRequestTrace,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import {
	getUsdaFoodById,
	searchUsdaBrandedFoods,
} from "$lib/server/products/usdaCache.server";
import { selectPreferredUsdaBarcodeFood } from "$lib/server/products/usdaFoodSelection";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapFdcBarcodeFood,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/barcodeProductMappers";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";
import type { FoodItem } from "$lib/utils/food/types";

export const lookupUsdaBarcodeProduct = async (
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
				const searchResult = await searchUsdaBrandedFoods(candidate, trace);
				return selectPreferredUsdaBarcodeFood(
					searchResult.foods ?? [],
					canonicalBarcode,
				);
			},
		);
		const match = candidateMatch?.value ?? null;
		if (!match) {
			await recordProductSourceLookup({
				sourceKey: "usda",
				sourceDataType: "Branded",
				lookupKind: "barcode",
				outcome: "not-found",
				startedAt,
				trace,
			});
			return null;
		}

		let food: FoodItem;
		try {
			food = await getUsdaFoodById(match.fdcId, trace);
		} catch {
			food = match;
		}
		const matchedBarcode = normalizeBarcode(
			food.gtinUpc ?? candidateMatch?.candidate ?? canonicalBarcode,
		);
		if (!matchedBarcode) return null;

		const draft = mapFdcBarcodeFood(
			food,
			matchedBarcode,
			productReferenceCatalog ?? (await getProductReferenceCatalog()),
		);
		await recordProductSourceLookup({
			sourceKey: "usda",
			sourceDataType: draft?.sourceDataType ?? "Branded",
			lookupKind: "barcode",
			outcome: draft ? "matched" : "not-found",
			startedAt,
			trace,
			quality: draft ? summarizeBarcodeProductQuality(draft) : undefined,
			exactBarcodeMatch: Boolean(draft),
		});
		return draft;
	} catch (error) {
		await recordProductSourceLookup({
			sourceKey: "usda",
			sourceDataType: "Branded",
			lookupKind: "barcode",
			outcome: "error",
			startedAt,
			trace,
		});
		throw error;
	}
};
