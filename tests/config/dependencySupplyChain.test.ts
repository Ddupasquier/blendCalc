import { readFileSync } from "node:fs";
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

	it("installs the exact public Rehearsal beta from npm", () => {
		const packageName = "@rehearsal-db/core";
		const version = "0.1.0-beta.13";
		const installedPackage =
			packageLock.packages[`node_modules/${packageName}`];

		expect(packageMetadata.devDependencies?.[packageName]).toBe(version);
		expect(installedPackage?.version).toBe(version);
		expect(installedPackage?.resolved).toBe(
			`https://registry.npmjs.org/@rehearsal-db/core/-/core-${version}.tgz`,
		);
		expect(installedPackage?.integrity).toBe(
			"sha512-zyIt3cKqaggkElhXwNqhZwZ8VFYXF1pzc21ZqgU/va1IbNlkKWUjYDD1pE+1uPc2TLqaEXS6L6K/tFo0ANAsxw==",
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
		] as const) {
			const version = packageLock.packages[`node_modules/${name}`]?.version;
			expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
			const actual = version!.split(".").map(Number);
			const order = actual.findIndex((part, index) => part !== minimum[index]);
			expect(order === -1 || actual[order] > minimum[order], name).toBe(true);
		}
	});
});
