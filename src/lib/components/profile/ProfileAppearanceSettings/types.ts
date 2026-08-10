import type { ThemePreference } from "$lib/utils/theme/themePreference";

export type ProfileAppearanceSettingsProps = {
	initialTheme: ThemePreference;
	errorMessage?: string | null;
	successMessage?: string | null;
	onSaveSuccess?: () => void;
};
