import type { CatalogProductRepairWorkspaceData } from "$lib/server/moderation/catalogProductRepairWorkspace.server";
import type { CatalogHealthRepairActionData } from "$lib/utils/moderation/catalogHealthRepair";

export type CatalogOperationsProductPageProps = {
	data: CatalogProductRepairWorkspaceData;
	form?: CatalogHealthRepairActionData | null;
};
