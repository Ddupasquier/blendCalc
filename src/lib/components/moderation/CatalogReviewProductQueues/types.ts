import type { CatalogReviewProductPages } from "$lib/utils/moderation/catalogReviewPagination";
import type { CatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";
import type { CatalogReviewWorkSummary } from "$lib/utils/moderation/catalogReviewWork";
import type { ProductEvidenceRole } from "$lib/utils/products/productEvidenceRequirements";

export type CatalogReviewProductQueuesProps = {
	productId: string;
	pages: CatalogReviewProductPages;
	handoff: CatalogCorrectionHandoff;
	scrollContainer: HTMLElement | null;
	correctionAvailable?: boolean;
	onOpenCorrection?: (evidenceRoles: ProductEvidenceRole[]) => void;
	onCountsChange?: (counts: CatalogReviewWorkSummary["counts"]) => void;
};
