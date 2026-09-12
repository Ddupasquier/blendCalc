import type { CatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";

export type CatalogConflictDecisionWorkbenchProps = {
	productId: string;
	handoff: CatalogCorrectionHandoff;
};

export type CatalogConflictDecision = {
	outcome: string;
	observationIndex: string;
	note: string;
	replacementValue: string;
	evidenceReference: string;
};
