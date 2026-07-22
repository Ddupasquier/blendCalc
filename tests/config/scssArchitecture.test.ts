import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { execFileSync } from "node:child_process";
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
		let output = "";
		try {
			output = execFileSync(
				"rg",
				[
					"-n",
					"\\$(color-|app-rebuild|app-mobile-shell-width|app-vertical-stack-gap|app-horizontal-control-gap|ingredient-|mix-|nutrition-label-)",
					"src",
					"--glob",
					"*.svelte",
					"--glob",
					"*.scss",
				],
				{ encoding: "utf8" },
			);
		} catch (error) {
			const status = (error as { status?: number }).status;
			if (status !== 1) throw error;
		}

		expect(output).toBe("");
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
			expect(basename(dirname(stylePath)), stylePath).toBe(componentName);
			expect(existsSync(join(dirname(stylePath), `${componentName}.svelte`)), stylePath).toBe(true);
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
		expect(readdirSync("src/styles").sort()).toEqual(["_variables.scss"]);
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
