import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const visibleRawControlPattern =
	/<(?:button|select|textarea)\b|<input\b(?![^>]*\btype\s*=\s*["']hidden["'])/gms;

const readSvelteFilesRecursively = (directory: string) =>
	readdirSync(directory, { recursive: true, encoding: "utf8" })
		.filter((relativePath) => relativePath.endsWith(".svelte"))
		.map((relativePath) => ({
			path: join(directory, relativePath),
			source: readFileSync(join(directory, relativePath), "utf8"),
		}));

describe("shared form control architecture", () => {
	it("keeps route-owned authentication controls on shared primitives", () => {
		const authenticationRoutes = readSvelteFilesRecursively("src/routes/auth");

		for (const route of authenticationRoutes) {
			expect(
				route.source.match(visibleRawControlPattern),
				route.path,
			).toBeNull();
		}

		const authenticationPage = readFileSync(
			"src/routes/auth/+page.svelte",
			"utf8",
		);
		const passwordUpdatePage = readFileSync(
			"src/routes/auth/update-password/+page.svelte",
			"utf8",
		);

		expect(authenticationPage).toContain("RoundedActionButton");
		expect(authenticationPage).toContain("TextField");
		expect(passwordUpdatePage).toContain("RoundedActionButton");
		expect(passwordUpdatePage).toContain("TextField");
	});

	it("keeps privileged-review controls on shared primitives", () => {
		const privilegedComponents = readSvelteFilesRecursively(
			"src/lib/components/moderation",
		);
		const legacyModerationRoutes = readSvelteFilesRecursively(
			"src/routes/moderation",
		);

		for (const component of [
			...privilegedComponents,
			...legacyModerationRoutes,
		]) {
			expect(
				component.source.match(visibleRawControlPattern),
				component.path,
			).toBeNull();
		}
	});
});
