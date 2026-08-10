import type { ModeratorActionSummary } from "$lib/server/moderation/moderatorActionSummary.server";

export type ProfileModeratorActionSheetProps = {
	open: boolean;
	summary: ModeratorActionSummary;
	onClose: () => void;
	onNavigate: (href: string) => void;
};
