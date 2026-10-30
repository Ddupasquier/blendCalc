import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type PackageMetadata = {
	allowScripts?: Record<string, boolean>;
	devDependencies?: Record<string, string>;
};

type PackageLock = {
	packages: Record<
		string,
		{ integrity?: string; resolved?: string; version?: string }
	>;
};

const packageMetadata = JSON.parse(
	readFileSync("package.json", "utf8"),
) as PackageMetadata;
const packageLock = JSON.parse(
	readFileSync("package-lock.json", "utf8"),
) as PackageLock;

describe("dependency supply-chain configuration", () => {
	it("resolves the plugin's reviewed security fork without changing the plugin", () => {
		const plugin =
			packageLock.packages["node_modules/@sveltejs/vite-plugin-svelte"];
		const patched =
			packageLock.packages[
				"node_modules/@sveltejs/vite-plugin-svelte/node_modules/deepmerge"
			];
		expect(plugin.version).toBe("7.2.0");
		expect(patched.version).toBe("4.3.2");
		expect(patched.resolved).toBe(
			"https://registry.npmjs.org/@oss-cve-patches/deepmerge/-/deepmerge-4.3.2.tgz",
		);
		expect(patched.integrity).toBe(
			"sha512-+bwDJSwj3aBdqYf5FetlCvGMrh4LAemnTwmTdN8QaNj4R4+EYuQostFyu2fr2wTACTqCOkYSg7Kju8xrUwxyRg==",
		);
		expect(packageLock.packages).not.toHaveProperty("node_modules/deepmerge");
	});

	describe("the merge implementation actually resolved by the Svelte plugin", () => {
		const localRequire = createRequire(import.meta.url);
		const pluginRequire = createRequire(
			localRequire.resolve("@sveltejs/vite-plugin-svelte"),
		);
		const merge = pluginRequire("deepmerge") as (
			target: Record<string, unknown>,
			source: Record<string, unknown>,
			options?: {
				arrayMerge: (target: unknown[], source: unknown[]) => unknown[];
			},
		) => Record<string, unknown>;

		it.each(["target", "source", "null-prototype", "nested"])(
			"rejects prototype replacement from %s while preserving ordinary options",
			(position) => {
				const hostile = JSON.parse(
					'{"__proto__":{"pollutionCanary":true},"safe":7}',
				);
				const result =
					position === "target"
						? merge(hostile, { enabled: true })
						: position === "source"
							? merge({}, hostile)
							: position === "null-prototype"
								? merge(Object.create(null), hostile)
								: merge(
										{ compilerOptions: null },
										{ compilerOptions: hostile },
									);
				const checked = position === "nested" ? result.compilerOptions : result;
				expect(Object.getPrototypeOf(checked)).toBe(Object.prototype);
				expect(Object.hasOwn(checked as object, "__proto__")).toBe(false);
				expect(checked).toHaveProperty("safe", 7);
				expect(checked).not.toHaveProperty("pollutionCanary");
				expect(Object.prototype).not.toHaveProperty("pollutionCanary");
			},
		);

		it("preserves the plugin's replacement-array and nested-option semantics", () => {
			const preprocess = () => "preprocess";
			const target = {
				compilerOptions: { dev: true },
				preprocess: [() => "old"],
			};
			const source = {
				compilerOptions: { css: "external" },
				preprocess: [preprocess],
			};
			const result = merge(target, source, {
				arrayMerge: (_target, incoming) => incoming,
			});
			expect(result).toEqual({
				compilerOptions: { dev: true, css: "external" },
				preprocess: [preprocess],
			});
			expect(target.compilerOptions).toEqual({ dev: true });
			expect(source.compilerOptions).toEqual({ css: "external" });
		});
	});

	it("allows only exact installed package script versions", () => {
		const entries = Object.entries(packageMetadata.allowScripts ?? {});
		expect(entries.length).toBeGreaterThan(0);

		for (const [specifier, enabled] of entries) {
			const versionSeparator = specifier.lastIndexOf("@");
			const packageName = specifier.slice(0, versionSeparator);
			const version = specifier.slice(versionSeparator + 1);

			expect(enabled, specifier).toBe(true);
			expect(packageName, specifier).not.toBe("");
			expect(version, specifier).toMatch(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/);
			const installedVersions = Object.entries(packageLock.packages)
				.filter(([packagePath]) =>
					packagePath.endsWith(`node_modules/${packageName}`),
				)
				.map(([, metadata]) => metadata.version);
			expect(installedVersions, specifier).toContain(version);
		}
	});

	it("does not grant wildcard script approval", () => {
		const allowedSpecifiers = Object.keys(packageMetadata.allowScripts ?? {});
		expect(allowedSpecifiers).not.toContain("*");
		expect(
			allowedSpecifiers.every((specifier) => !specifier.includes("*")),
		).toBe(true);
	});

	it("installs the exact public Rehearsal release from npm", () => {
		const packageName = "@rehearsal-db/core";
		const version = "1.0.2";
		const installedPackage =
			packageLock.packages[`node_modules/${packageName}`];

		expect(packageMetadata.devDependencies?.[packageName]).toBe(version);
		expect(installedPackage?.version).toBe(version);
		expect(installedPackage?.resolved).toBe(
			`https://registry.npmjs.org/@rehearsal-db/core/-/core-${version}.tgz`,
		);
		expect(installedPackage?.integrity).toBe(
			"sha512-VuNI71ClTrFdpdYh64C+9rhFNwE6g4gpAKdnCO3actpxL6hHU69qMcCen8DQc4h21Dhcmal4kP0pmQhf2/6prw==",
		);
		expect(packageMetadata.devDependencies).not.toHaveProperty("@rehearsal/db");
		expect(packageLock.packages).not.toHaveProperty(
			"node_modules/@rehearsal/db",
		);
	});

	it("keeps patched image and parser packages above their security floors", () => {
		for (const [name, minimum] of [
			["sharp", [0, 35, 5]],
			["source-map-js", [1, 2, 2]],
			["postcss-selector-parser", [7, 1, 6]],
			["vitest", [4, 1, 12]],
			["@vitest/mocker", [4, 1, 12]],
		] as const) {
			const version = packageLock.packages[`node_modules/${name}`]?.version;
			expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
			const actual = version!.split(".").map(Number);
			const order = actual.findIndex((part, index) => part !== minimum[index]);
			expect(order === -1 || actual[order] > minimum[order], name).toBe(true);
		}
	});
});
