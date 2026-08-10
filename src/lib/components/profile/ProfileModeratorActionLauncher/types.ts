import type { ModeratorActionSummary } from "$lib/server/moderation/moderatorActionSummary.server";

export type ProfileModeratorActionLauncherProps = {
	summary: ModeratorActionSummary;
	onOpen: () => void;
};
