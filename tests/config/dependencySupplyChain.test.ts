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
		const version = "0.1.0-beta.1";
		const installedPackage =
			packageLock.packages[`node_modules/${packageName}`];

		expect(packageMetadata.devDependencies?.[packageName]).toBe(version);
		expect(installedPackage?.version).toBe(version);
		expect(installedPackage?.resolved).toBe(
			`https://registry.npmjs.org/@rehearsal-db/core/-/core-${version}.tgz`,
		);
		expect(installedPackage?.integrity).toBe(
			"sha512-MFCJF4aNqk/XUKej0dG9K1t300+BoPnxOVVmOSx5W5mS+Zj39MMpEHsqBBn1d0O2TScPMSb8pmvaIg1rgSZ1eg==",
		);
		expect(packageMetadata.devDependencies).not.toHaveProperty("@rehearsal/db");
		expect(packageLock.packages).not.toHaveProperty(
			"node_modules/@rehearsal/db",
		);
	});
});
