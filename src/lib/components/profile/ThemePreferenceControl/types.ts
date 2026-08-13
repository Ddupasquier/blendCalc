import type { ThemePreference } from "$lib/utils/theme/themePreference";

export type ThemePreferenceControlProps = {
	value: ThemePreference;
	disabled?: boolean;
	visuallyHideLegend?: boolean;
	onSelect: (value: ThemePreference) => void;
};
