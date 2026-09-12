import type { CatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";
import type { CatalogDataOperationsHealth } from "$lib/utils/moderation/catalogDataOperationsHealth";

export type CatalogDataOperationsDashboardProps = {
	dashboard: CatalogDataOperationsHealth;
	catalogMonitor: CatalogMonitorModerationSummary;
};
