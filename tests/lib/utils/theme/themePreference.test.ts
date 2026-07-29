import { describe, expect, it } from "vitest";
import {
	applyThemePreference,
	DARK_THEME_COLOR,
	getThemePreferenceCookieOptions,
	LIGHT_THEME_COLOR,
	normalizeThemePreference,
	resolveThemePreference,
} from "$lib/utils/theme/themePreference";

describe("theme preference", () => {
	it("accepts only supported persisted values", () => {
		expect(normalizeThemePreference("system")).toBe("system");
		expect(normalizeThemePreference("light")).toBe("light");
		expect(normalizeThemePreference("dark")).toBe("dark");
		expect(normalizeThemePreference("midnight")).toBe("system");
		expect(normalizeThemePreference(null)).toBe("system");
	});

	it("resolves the device setting without overriding explicit choices", () => {
		expect(resolveThemePreference("system", false)).toBe("light");
		expect(resolveThemePreference("system", true)).toBe("dark");
		expect(resolveThemePreference("light", true)).toBe("light");
		expect(resolveThemePreference("dark", false)).toBe("dark");
	});

	it("updates the document theme and browser chrome color together", () => {
		const root = document.documentElement;
		const meta = document.createElement("meta");

		expect(applyThemePreference("dark", false, root, meta)).toBe("dark");
		expect(root.dataset.theme).toBe("dark");
		expect(root.style.colorScheme).toBe("dark");
		expect(meta.content).toBe(DARK_THEME_COLOR);

		expect(applyThemePreference("system", false, root, meta)).toBe("light");
		expect(root.dataset.theme).toBe("system");
		expect(root.style.colorScheme).toBe("light");
		expect(meta.content).toBe(LIGHT_THEME_COLOR);
	});

	it("uses a durable, non-HttpOnly preference cookie", () => {
		expect(getThemePreferenceCookieOptions(true)).toEqual({
			path: "/",
			httpOnly: false,
			sameSite: "lax",
			secure: true,
			maxAge: 31_536_000,
		});
	});
});
