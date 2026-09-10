import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import {
	parseCatalogProductReviewDispositionResult,
	type CatalogProductReviewDispositionResult,
} from "$lib/utils/moderation/catalogProductReviewDisposition";

export type CatalogProductReviewDispositionFailureReason =
	| "checks_required"
	| "review_unavailable"
	| "validation"
	| "service_unavailable";

export class CatalogProductReviewDispositionError extends Error {
	constructor(readonly reason: CatalogProductReviewDispositionFailureReason) {
		super(reason);
		this.name = "CatalogProductReviewDispositionError";
	}
}

const classifyFailure = (error: {
	code?: string;
	message?: string;
}): CatalogProductReviewDispositionFailureReason => {
	if (error.code === "P0002") return "review_unavailable";
	if (error.code === "22023") return "validation";
	if (error.message?.toLowerCase().includes("safe repair check")) {
		return "checks_required";
	}
	return "service_unavailable";
};

export const finishCatalogProductReview = async (
	supabase: SupabaseClient<Database>,
	request: { sharedProductId: string; reviewNote: string },
): Promise<CatalogProductReviewDispositionResult> => {
	const { data, error } = await supabase.rpc(
		"finish_catalog_health_product_review",
		{
			p_shared_product_id: request.sharedProductId,
			p_review_note: request.reviewNote,
		},
	);

	if (error) {
		throw new CatalogProductReviewDispositionError(classifyFailure(error));
	}

	try {
		return parseCatalogProductReviewDispositionResult(data);
	} catch {
		throw new CatalogProductReviewDispositionError("service_unavailable");
	}
};
