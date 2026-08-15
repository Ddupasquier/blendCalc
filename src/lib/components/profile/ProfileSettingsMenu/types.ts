import type { ThemePreference } from "$lib/utils/theme/themePreference";
import type { ProfileSettingsRoute } from "$lib/utils/profile/profileRouteState";

export type ProfileSettingsMenuProps = {
	appearanceTheme: ThemePreference;
	cheekyMessagesEnabled: boolean;
	displayName: string;
	bio: string;
	hasProfileImage: boolean;
	allergenCount: number;
	dietaryRestrictionCount: number;
	priorityNutrientCount: number;
	onOpen: (settingsRoute: ProfileSettingsRoute) => void;
};
