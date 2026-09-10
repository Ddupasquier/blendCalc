import type { CatalogProductReadinessPassport } from "$lib/utils/moderation/catalogProductReadinessPassport";
import type { CatalogProductReviewDispositionActionData } from "$lib/utils/moderation/catalogProductReviewDisposition";

export type CatalogProductReviewDispositionProps = {
	passport: CatalogProductReadinessPassport;
	canFinishReview: boolean;
	form?: CatalogProductReviewDispositionActionData | null;
};
