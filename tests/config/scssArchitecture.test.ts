import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const variablesPath = "src/styles/_variables.scss";
const variables = readFileSync(variablesPath, "utf8");

const walkFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		return statSync(path).isDirectory() ? walkFiles(path) : [path];
	});

const componentFiles = [
	...walkFiles("src/lib/components"),
	...walkFiles("src/lib/assets/icons"),
].filter(
	(path) => extname(path) === ".svelte",
);
const componentStyleFiles = [
	...walkFiles("src/lib/components"),
	...walkFiles("src/lib/assets/icons"),
].filter(
	(path) => extname(path) === ".scss",
);
const routeFiles = walkFiles("src/routes");
const applicationStyleSourceFiles = walkFiles("src").filter((path) =>
	[".scss", ".svelte"].includes(extname(path)),
);
const applicationStyleFiles = [
	"src/app.scss",
	...componentStyleFiles,
	...routeFiles.filter((path) => extname(path) === ".scss"),
];
const measuredRawColorFiles = new Set([
	"src/lib/components/ingredients/barcode/BarcodeScannerDialog/BarcodeScannerDialog.scss",
	"src/lib/components/ingredients/barcode/BarcodeScannerIcon/BarcodeScannerIcon.scss",
	"src/lib/components/ingredients/card/IngredientCardMediaLane/IngredientCardMediaLane.scss",
	"src/lib/components/ingredients/nutrition/NutritionFactsLabel/NutritionFactsLabel.scss",
	"src/lib/components/profile/ThemePreferenceControl/ThemePreferenceControl.scss",
]);

describe("SCSS architecture", () => {
	it("keeps global tokens direct and free of obsolete namespaces", () => {
		const definitions = [...variables.matchAll(/^\$([\w-]+):\s*([^;]+);/gm)];

		expect(definitions.length).toBeGreaterThan(0);
		for (const [, name, value] of definitions) {
			expect(name).not.toMatch(/^(color|ingredient|mix|nutrition-label)-/);
			expect(name).not.toContain("rebuild");
			expect(value, `$${name} must point directly to its value`).not.toMatch(/\$[\w-]+/);
		}
	});

	it("does not use retired token namespaces in application styles", () => {
		const retiredTokenPattern =
			/\$(?:color-|app-rebuild|app-mobile-shell-width|app-vertical-stack-gap|app-horizontal-control-gap|ingredient-|mix-|nutrition-label-)/;
		const violations = applicationStyleSourceFiles.flatMap((path) =>
			readFileSync(path, "utf8")
				.split("\n")
				.flatMap((line, index) =>
					retiredTokenPattern.test(line) ? [`${path}:${index + 1}: ${line.trim()}`] : [],
				),
		);

		expect(violations).toEqual([]);
	});

	it("keeps application typography on the shared semantic scale", () => {
		const declarationPattern =
			/(font-size|font-family|font-weight|line-height|letter-spacing):\s*([^;]+);/g;
		const allowedValuePattern = /^(?:\$[\w-]+|var\(|inherit$)/;
		const violations = applicationStyleFiles.flatMap((path) => {
			const source = readFileSync(path, "utf8");
			return [...source.matchAll(declarationPattern)]
				.filter((match) => !allowedValuePattern.test(match[2].trim()))
				.map((match) => `${path}: ${match[0]}`);
		});

		expect(violations).toEqual([]);
	});

	it("keeps shared surfaces free of box shadows", () => {
		const violations = applicationStyleFiles.filter((path) =>
			/box-shadow\s*:/.test(readFileSync(path, "utf8")),
		);

		expect(violations).toEqual([]);
	});

	it("uses named responsive breakpoints instead of numeric media thresholds", () => {
		const violations = applicationStyleFiles.flatMap((path) => {
			const source = readFileSync(path, "utf8");
			return [...source.matchAll(/@media[^\{]*(?:\d+(?:\.\d+)?(?:px|rem|em))/g)]
				.map((match) => `${path}: ${match[0]}`);
		});

		expect(violations).toEqual([]);
	});

	it("limits raw colors to measured artifacts and explicit theme previews", () => {
		const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;
		const violations = applicationStyleFiles.flatMap((path) => {
			if (measuredRawColorFiles.has(path)) return [];
			const source = readFileSync(path, "utf8");
			return [...source.matchAll(rawColorPattern)].map(
				(match) => `${path}: ${match[0]}`,
			);
		});

		expect(violations).toEqual([]);
	});

	it("keeps every component in a namesake folder", () => {
		for (const componentPath of componentFiles) {
			const componentName = basename(componentPath, ".svelte");
			expect(basename(dirname(componentPath)), componentPath).toBe(componentName);
		}
	});

	it("keeps component styles paired and scoped to their owner", () => {
		for (const stylePath of componentStyleFiles) {
			const componentName = basename(stylePath, ".scss");
			const ownerName = basename(dirname(stylePath));
			expect(
				existsSync(join(dirname(stylePath), `${ownerName}.svelte`)),
				stylePath,
			).toBe(true);
			if (!componentName.startsWith("_")) {
				expect(ownerName, stylePath).toBe(componentName);
			}
		}

		for (const componentPath of componentFiles) {
			const componentName = basename(componentPath, ".svelte");
			const source = readFileSync(componentPath, "utf8");
			const pairedStyle = join(dirname(componentPath), `${componentName}.scss`);
			const hasStyleBlock = source.includes("<style");

			expect(hasStyleBlock, componentPath).toBe(existsSync(pairedStyle));
			if (hasStyleBlock) {
				expect(source, componentPath).toContain(`@use "./${componentName}.scss"`);
			}
			expect(source, componentPath).not.toMatch(/<script[^>]*>[\s\S]*?import\s+["'][^"']+\.scss["']/);
		}
	});

	it("keeps route page styles beside and scoped through their page", () => {
		for (const stylePath of routeFiles.filter((path) => basename(path) === "page.scss")) {
			const pagePath = join(dirname(stylePath), "+page.svelte");
			expect(existsSync(pagePath), stylePath).toBe(true);
			expect(readFileSync(pagePath, "utf8"), pagePath).toContain('@use "./page.scss"');
		}

		for (const pagePath of routeFiles.filter((path) => basename(path) === "+page.svelte")) {
			const source = readFileSync(pagePath, "utf8");
			expect(source, pagePath).not.toMatch(/<script[^>]*>[\s\S]*?import\s+["'][^"']+\.scss["']/);
		}
	});

	it("keeps feature styles out of the global styles folder", () => {
		expect(readdirSync("src/styles").sort()).toEqual([
			"_themes.scss",
			"_variables.scss",
		]);
	});

	it("keeps declarations of UI types out of Svelte files", () => {
		for (const path of [...componentFiles, ...routeFiles.filter((file) => extname(file) === ".svelte")]) {
			const source = readFileSync(path, "utf8");
			expect(source, path).not.toMatch(/^\s*(?:export\s+)?type\s+\w+\s*=/m);
			expect(source, path).not.toMatch(/^\s*(?:export\s+)?interface\s+\w+(?:\s+extends[^\{]+)?\s*\{/m);
			expect(source, path).not.toContain("$props<{");
		}
	});
});
