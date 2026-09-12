import type { CatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";

export type CatalogConflictDecisionWorkbenchProps = {
	productId: string;
	handoff: CatalogCorrectionHandoff;
};
