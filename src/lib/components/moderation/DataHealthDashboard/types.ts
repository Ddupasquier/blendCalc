import type { ModeratorDataHealth } from "$lib/utils/moderation/dataHealth";

export type DataHealthDashboardProps = {
	dashboard: ModeratorDataHealth;
	viewerRole: "moderator" | "admin";
};
