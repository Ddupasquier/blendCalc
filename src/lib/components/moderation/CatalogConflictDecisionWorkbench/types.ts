import type { CatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";
import type { Snippet } from "svelte";

export type CatalogConflictDecisionWorkbenchProps = {
	productId: string;
	handoff: CatalogCorrectionHandoff;
	totalCount?: number;
	refreshing?: boolean;
	evidenceRevision?: string;
	paginationControls?: Snippet;
};

export type CatalogConflictDecision = {
	outcome: string;
	observationIndex: string;
	note: string;
	replacementValue: string;
	evidenceReference: string;
};
