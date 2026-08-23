import type { CatalogHealthRepairActionData } from "$lib/utils/moderation/catalogHealthRepair";
import type { CatalogProductReadinessIssue } from "$lib/utils/moderation/catalogProductReadinessPassport";

export type CatalogProductRepairControlsProps = {
	issues: CatalogProductReadinessIssue[];
	form?: CatalogHealthRepairActionData | null;
};
