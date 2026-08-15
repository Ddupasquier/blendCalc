import type { ModeratorDataHealth } from "$lib/utils/moderation/dataHealth";
import type { CatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";
import type { AppRole } from "$lib/utils/moderation/moderation";

export type DataHealthDashboardProps = {
  dashboard: ModeratorDataHealth;
  catalogMonitor: CatalogMonitorModerationSummary;
  viewerRole: AppRole;
};
