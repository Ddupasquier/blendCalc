import type { CatalogProductReadinessPassport } from "$lib/utils/moderation/catalogProductReadinessPassport";
import type {
	CatalogProductReviewCategory,
	CatalogProductReviewDispositionActionData,
} from "$lib/utils/moderation/catalogProductReviewDisposition";

export type CatalogProductReviewDispositionProps = {
	passport: CatalogProductReadinessPassport;
	category: CatalogProductReviewCategory;
	canFinishReview: boolean;
	form?: CatalogProductReviewDispositionActionData | null;
};
