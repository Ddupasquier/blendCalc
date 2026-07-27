import { getProductReferenceData } from "$lib/server/products/productReferenceData.server";
import {
	createProductSourceRequestTrace,
	recordProductSourceLookup,
} from "$lib/server/products/sourceMetrics.server";
import { getUsdaFoodById, searchUsdaBrandedFoods } from "$lib/server/products/usdaCache.server";
import { selectPreferredUsdaBarcodeFood } from "$lib/server/products/usdaFoodSelection";
import { findFirstBarcodeCandidateMatch } from "$lib/server/products/barcodeCandidateLookup";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	mapFdcBarcodeFood,
	type BarcodeProductDraft,
} from "$lib/utils/barcode/barcodeProductMappers";
import type { ProductReferenceData } from "$lib/utils/food/reference/productReferenceData";
import { summarizeBarcodeProductQuality } from "$lib/utils/food/sources/sourceQuality";
import type { FdcFood } from "$lib/utils/food/types";

export const lookupUsdaBarcodeProduct = async (
	barcode: string,
	referenceData?: ProductReferenceData,
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

		let food: FdcFood;
		try {
			food = await getUsdaFoodById(match.fdcId, trace);
		} catch {
			food = match;
		}

		const draft = mapFdcBarcodeFood(
			food,
			canonicalBarcode,
			referenceData ?? await getProductReferenceData(),
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
