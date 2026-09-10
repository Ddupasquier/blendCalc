import type { CatalogProductRepairWorkspaceData } from "$lib/server/moderation/catalogProductRepairWorkspace.server";
import type { CatalogHealthRepairActionData } from "$lib/utils/moderation/catalogHealthRepair";
import type { CatalogProductReviewDispositionActionData } from "$lib/utils/moderation/catalogProductReviewDisposition";

export type CatalogOperationsProductPageProps = {
	data: CatalogProductRepairWorkspaceData;
	form?:
		| (CatalogHealthRepairActionData &
				CatalogProductReviewDispositionActionData)
		| null;
};
