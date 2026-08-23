import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";

export type ProfilePrivilegedToolsSheetProps = {
	open: boolean;
	access: ProfilePrivilegedToolAccess;
	onClose: () => void;
	onNavigate: (href: string) => void;
};
