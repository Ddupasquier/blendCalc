import {
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const appHtml = readFileSync("src/app.html", "utf8");
const layout = readFileSync("src/routes/+layout.svelte", "utf8");
const layoutServer = readFileSync("src/routes/+layout.server.ts", "utf8");
const profile = readFileSync("src/routes/profile/+page.svelte", "utf8");
const hooks = readFileSync("src/hooks.server.ts", "utf8");
const variables = readFileSync("src/styles/_variables.scss", "utf8");
const themes = readFileSync("src/styles/_themes.scss", "utf8");

const fixedColorStyles = new Set([
	"src/lib/components/app/TutorialOverlay/TutorialOverlay.scss",
	"src/lib/components/ingredients/barcode/BarcodeScannerDialog/BarcodeScannerDialog.scss",
	"src/lib/components/ingredients/barcode/BarcodeScannerIcon/BarcodeScannerIcon.scss",
	"src/lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardMediaLane.scss",
	"src/lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.scss",
	"src/lib/components/profile/ThemePreferenceControl/ThemePreferenceControl.scss",
	"src/styles/_themes.scss",
]);

const collectScssFiles = (directory: string): string[] => {
	return readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory()
			? collectScssFiles(path)
			: path.endsWith(".scss")
				? [path]
				: [];
	});
};

const stripScssComments = (source: string) => {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "");
};

const hardcodedColorPattern =
	/(?:#[0-9a-f]{3,8}\b|rgba?\(|(?:^|[;{]\s*)(?:color|background(?:-color)?|border(?:-[a-z]+)?-color|fill|stroke)\s*:\s*(?:black|white)\b)/i;

const readThemeColor = (
	themeName: "light" | "dark",
	property: string,
) => {
	const themeBlock = themes.match(
		new RegExp(`@mixin ${themeName}-theme \\{([\\s\\S]*?)\\n\\}`),
	)?.[1];
	const color = themeBlock?.match(
		new RegExp(`${property}:\\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?);`, "i"),
	)?.[1];
	if (!color) {
		throw new Error(`Missing ${property} in ${themeName} theme`);
	}
	return color;
};

const relativeLuminance = (hex: string) => {
	const normalizedHex = hex.length === 4
		? `#${[...hex.slice(1)].map((channel) => channel.repeat(2)).join("")}`
		: hex;
	const channels = normalizedHex
		.slice(1)
		.match(/.{2}/g)
		?.map((channel) => Number.parseInt(channel, 16) / 255)
		.map((channel) => {
			return channel <= 0.04045
				? channel / 12.92
				: ((channel + 0.055) / 1.055) ** 2.4;
		});
	if (!channels || channels.length !== 3) {
		throw new Error(`Invalid color ${hex}`);
	}
	return 0.2126 * channels[0] +
		0.7152 * channels[1] +
		0.0722 * channels[2];
};

const contrastRatio = (foreground: string, background: string) => {
	const lighter = Math.max(
		relativeLuminance(foreground),
		relativeLuminance(background),
	);
	const darker = Math.min(
		relativeLuminance(foreground),
		relativeLuminance(background),
	);
	return (lighter + 0.05) / (darker + 0.05);
};

describe("theme architecture", () => {
	it("starts with a system theme before client hydration", () => {
		expect(appHtml).toContain('data-theme="system"');
		expect(layout).toContain("ThemeSynchronizer");
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

	it("keeps theme-sensitive component colors on semantic roles", () => {
		const violations = collectScssFiles("src")
			.map((path) => relative(".", path))
			.filter((path) => !fixedColorStyles.has(path))
			.filter((path) => {
				return hardcodedColorPattern.test(
					stripScssComments(readFileSync(path, "utf8")),
				);
			});

		expect(violations).toEqual([]);
		expect(variables).toContain(
			"$app-shell-text-on-accent: var(--app-shell-text-on-accent)",
		);
		expect(variables).toContain(
			"$app-shell-overlay-backdrop: var(--app-shell-overlay-backdrop)",
		);
	});

	it.each(["light", "dark"] as const)(
		"keeps core %s-theme text pairs at WCAG AA contrast",
		(themeName) => {
			const pairs = [
				["--app-shell-text-primary", "--app-shell-surface-panel"],
				["--app-shell-text-muted", "--app-shell-surface-panel"],
				["--app-shell-text-on-accent", "--app-shell-accent-primary"],
				["--app-shell-text-on-custom", "--app-custom-strong"],
				["--app-shell-text-on-danger", "--app-shell-accent-danger"],
				["--app-shell-text-on-danger", "--app-danger-action"],
				["--app-highlight-text", "--app-highlight"],
				["--app-highlight-text", "--app-highlight-hover"],
				["--app-warning-text", "--app-warning-bg"],
				["--app-btn-text", "--app-btn-bg"],
				["--app-btn-text", "--app-btn-bg-hover"],
			] as const;

			for (const [foregroundRole, backgroundRole] of pairs) {
				expect(
					contrastRatio(
						readThemeColor(themeName, foregroundRole),
						readThemeColor(themeName, backgroundRole),
					),
					`${foregroundRole} on ${backgroundRole}`,
				).toBeGreaterThanOrEqual(4.5);
			}
		},
	);

	it("uses the shared document theme colors during SSR and hydration", () => {
		expect(layout).toContain(
			'import { LIGHT_THEME_COLOR } from "$lib/utils/theme/themePreference"',
		);
		expect(layout).toContain(
			'<meta name="theme-color" content={LIGHT_THEME_COLOR} />',
		);
		expect(hooks).toContain("LIGHT_THEME_COLOR");
		expect(hooks).toContain("DARK_THEME_COLOR");
		expect(layout).not.toContain('content="#f8f8fb"');
	});

	it("exposes account-backed appearance controls from Profile", () => {
		expect(profile).toContain("ThemePreferenceControl");
		expect(profile).toContain('action="?/saveAppearance"');
		expect(profile).toContain("Save appearance");
	});
});
