export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEME_PREFERENCE_COOKIE = "blendcalc-theme";
export const LIGHT_THEME_COLOR = "#f8f8fb";
export const DARK_THEME_COLOR = "#11141c";

export const normalizeThemePreference = (
	value: unknown,
): ThemePreference => {
	return isThemePreference(value)
		? (value as ThemePreference)
		: "system";
};

export const isThemePreference = (
	value: unknown,
): value is ThemePreference => {
	return typeof value === "string" &&
		THEME_PREFERENCES.includes(value as ThemePreference);
};

export const resolveThemePreference = (
	preference: ThemePreference,
	prefersDark: boolean,
): ResolvedTheme => {
	return preference === "system"
		? prefersDark
			? "dark"
			: "light"
		: preference;
};

export const applyThemePreference = (
	preference: ThemePreference,
	prefersDark = false,
	root?: HTMLElement,
	themeColorMeta?: HTMLMetaElement | null,
) => {
	const resolvedTheme = resolveThemePreference(preference, prefersDark);

	if (root) {
		root.dataset.theme = preference;
		root.style.colorScheme = resolvedTheme;
	}
	if (themeColorMeta) {
		themeColorMeta.content =
			resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
	}

	return resolvedTheme;
};

export const getThemePreferenceCookieOptions = (secure: boolean) => ({
	path: "/",
	httpOnly: false,
	sameSite: "lax" as const,
	secure,
	maxAge: 60 * 60 * 24 * 365,
});
