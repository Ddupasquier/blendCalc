import type { CatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";

export type CatalogCorrectionHandoffProps = {
	handoff: CatalogCorrectionHandoff;
	returnPath: string;
	allowConflictResolution?: boolean;
};
