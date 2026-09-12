import type { CatalogProductReadinessPassport } from "$lib/utils/moderation/catalogProductReadinessPassport";

export type CatalogReviewProductRailProps = {
	passport: CatalogProductReadinessPassport;
	conflictCount: number;
	diagnosticCount: number;
	pendingSubmissionId: string | null;
};
