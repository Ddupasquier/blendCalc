import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	readProductReferenceData,
	type ProductReferenceData,
} from "$lib/utils/food/reference/productReferenceData";

const CACHE_DURATION_MILLISECONDS = 10 * 60 * 1000;

let cachedReferenceData: ProductReferenceData | null = null;
let cacheExpiresAt = 0;
let pendingReferenceData: Promise<ProductReferenceData> | null = null;

export const getProductReferenceData = async () => {
	const now = Date.now();
	if (cachedReferenceData && cacheExpiresAt > now) return cachedReferenceData;
	if (pendingReferenceData) return pendingReferenceData;

	pendingReferenceData = readProductReferenceData(getSupabaseAdminClient())
		.then((referenceData) => {
			cachedReferenceData = referenceData;
			cacheExpiresAt = Date.now() + CACHE_DURATION_MILLISECONDS;
			return referenceData;
		})
		.finally(() => {
			pendingReferenceData = null;
		});

	return pendingReferenceData;
};
