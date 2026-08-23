import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";

export type ProfilePrivilegedToolsLauncherProps = {
	access: ProfilePrivilegedToolAccess;
	onOpen: () => void;
};
