import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageMetadata = {
	allowScripts?: Record<string, boolean>;
};

type PackageLock = {
	packages: Record<string, { version?: string }>;
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
			expect(
				packageLock.packages[`node_modules/${packageName}`]?.version,
				specifier,
			).toBe(version);
		}
	});

	it("does not grant wildcard script approval", () => {
		const allowedSpecifiers = Object.keys(packageMetadata.allowScripts ?? {});
		expect(allowedSpecifiers).not.toContain("*");
		expect(allowedSpecifiers.every((specifier) => !specifier.includes("*"))).toBe(true);
	});
});
