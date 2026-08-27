import type { Actions } from "./$types";
import {
	savePlayfulMessagesPreference,
	saveProfileAppearance,
	saveProfileDetails,
} from "$lib/server/profile/profileAccountSettingsActions.server";
import { saveProfileFoodPreferences } from "$lib/server/profile/profileFoodPreferenceActions.server";
import {
	removeProfileImage,
	uploadProfileImage,
} from "$lib/server/profile/profileImageActions.server";

export const actions: Actions = {
	savePlayfulMessages: savePlayfulMessagesPreference,
	saveAppearance: saveProfileAppearance,
	saveProfile: saveProfileDetails,
	saveFoodPreferences: saveProfileFoodPreferences,
	uploadAvatar: uploadProfileImage,
	removeAvatar: removeProfileImage,
};
