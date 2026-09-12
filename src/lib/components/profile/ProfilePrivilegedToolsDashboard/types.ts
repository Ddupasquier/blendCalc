import type { CatalogMonitorModerationSummary } from "$lib/utils/moderation/catalogMonitorModeration";
import type { CatalogDataOperationsHealth } from "$lib/utils/moderation/catalogDataOperationsHealth";
import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";

export type ProfilePrivilegedToolsDiagnostics = {
	dashboard: CatalogDataOperationsHealth;
	catalogMonitor: CatalogMonitorModerationSummary;
};

export type ProfilePrivilegedToolsDashboardProps = {
	access: ProfilePrivilegedToolAccess;
	diagnostics: ProfilePrivilegedToolsDiagnostics | null;
	diagnosticsUnavailable: boolean;
};
