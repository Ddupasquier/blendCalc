import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appHtml = readFileSync("src/app.html", "utf8");
const layout = readFileSync("src/routes/+layout.svelte", "utf8");
const layoutServer = readFileSync("src/routes/+layout.server.ts", "utf8");
const profile = readFileSync("src/routes/profile/+page.svelte", "utf8");
const variables = readFileSync("src/styles/_variables.scss", "utf8");
const themes = readFileSync("src/styles/_themes.scss", "utf8");

describe("theme architecture", () => {
	it("starts with a system theme before client hydration", () => {
		expect(appHtml).toContain('data-theme="system"');
		expect(layout).toContain("ThemeController");
		expect(layout).toContain("preference={data.themePreference}");
		expect(layoutServer).toContain("themePreference: cookieThemePreference");
	});

	it("routes shared SCSS color roles through runtime theme properties", () => {
		expect(variables).toContain(
			"$app-shell-surface-page: var(--app-shell-surface-page)",
		);
		expect(variables).toContain("$app-primary: var(--app-primary)");
		expect(themes).toContain('@mixin light-theme');
		expect(themes).toContain('@mixin dark-theme');
		expect(themes).toContain(':root[data-theme="system"]');
	});

	it("exposes account-backed appearance controls from Profile", () => {
		expect(profile).toContain("ThemePreferenceControl");
		expect(profile).toContain('action="?/saveAppearance"');
		expect(profile).toContain("Save appearance");
	});
});
