import type { ModeratorDataHealth } from "$lib/utils/moderation/dataHealth";
import type { AppRole } from "$lib/utils/moderation/moderation";

export type DataHealthDashboardProps = {
  dashboard: ModeratorDataHealth;
  viewerRole: AppRole;
};
