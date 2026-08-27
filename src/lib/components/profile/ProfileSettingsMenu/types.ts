import type { ThemePreference } from "$lib/utils/theme/themePreference";
import type { ProfileSettingsRoute } from "$lib/utils/profile/profileRouteState";

export type ProfileSettingsMenuProps = {
	appearanceTheme: ThemePreference;
	playfulMessagesEnabled: boolean;
	bio: string;
	hasProfileImage: boolean;
	activeFoodPreferenceCount: number;
	pendingFoodPreferenceCount: number;
	priorityNutrientCount: number;
	onOpen: (settingsRoute: ProfileSettingsRoute) => void;
};
