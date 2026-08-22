import type { ProfileFoodPreferenceSettingsProps } from "$lib/components/profile/ProfileFoodPreferenceSettings/types";

export type ProfileFoodPreferenceViewProps =
	ProfileFoodPreferenceSettingsProps & {
		onClose: () => void;
		onSaveSuccess: () => void;
	};
