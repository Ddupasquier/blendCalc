import type { CatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";
import type { CatalogDataOperationsHealth } from "$lib/utils/moderation/catalogDataOperationsHealth";
import type { CatalogDataOperationSubject } from "$lib/utils/moderation/profilePrivilegedTools";

export type CatalogDataOperationsDashboardProps = {
	dashboard: CatalogDataOperationsHealth;
	catalogMonitor: CatalogMonitorModerationSummary;
	actionCount: number | null;
	actionSubjects: CatalogDataOperationSubject[] | null;
	actionSubjectsTruncated: boolean;
};
