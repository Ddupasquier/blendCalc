import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	APP_BUILD_VERSION,
	APP_MAJOR_VERSION,
	APP_VERSION,
	APP_VERSION_LABEL,
} from "$lib/config/version";
import { BLENDCALC_API_V1 } from "$lib/blendCalcAPI/v1/blendCalcAPITypes";

const packageMetadata = JSON.parse(readFileSync("package.json", "utf8")) as {
	version: string;
	engines: {
		node: string;
	};
	scripts: Record<string, string>;
};
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
	packages: Record<string, { version?: string; engines?: { node?: string } }>;
};
const configuredNodeMajor = Number.parseInt(
	readFileSync(".nvmrc", "utf8").trim(),
	10,
);
const portableNodeMajor = Number.parseInt(
	readFileSync(".node-version", "utf8").trim(),
	10,
);
const openAPI = JSON.parse(
	readFileSync("static/api/v1/openapi.json", "utf8"),
) as {
	info: {
		version: string;
		"x-blendcalc-status"?: string;
		"x-blendcalc-access"?: string;
		"x-blendcalc-public-release"?: string;
	};
	paths: Record<string, unknown>;
};
const appLayout = readFileSync("src/routes/+layout.svelte", "utf8");
const serverHook = readFileSync("src/hooks.server.ts", "utf8");
const semanticVersionPattern =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

describe("blendCalc versioning", () => {
	it("uses one supported Node major across local setup and package metadata", () => {
		const expectedEngine = `>=${configuredNodeMajor} <${configuredNodeMajor + 1}`;

		expect(configuredNodeMajor).toBe(24);
		expect(portableNodeMajor).toBe(configuredNodeMajor);
		expect(packageMetadata.engines.node).toBe(expectedEngine);
		expect(packageLock.packages[""]?.engines?.node).toBe(expectedEngine);
		expect(Number.parseInt(process.versions.node.split(".")[0], 10)).toBe(
			configuredNodeMajor,
		);
	});

	it("guards every interactive project runtime before startup", () => {
		const guardedLifecycleScripts = [
			"predev",
			"predev:test",
			"prebuild",
			"prepreview",
			"precheck",
			"precheck:watch",
			"pretest",
			"pretest:watch",
		];

		for (const script of guardedLifecycleScripts) {
			expect(packageMetadata.scripts[script], script).toContain(
				"npm run version:check",
			);
		}
	});

	it("uses one valid application release and keeps the MVP on major V1", () => {
		expect(packageMetadata.version).toMatch(semanticVersionPattern);
		expect(APP_VERSION).toBe(packageMetadata.version);
		expect(packageLock.packages[""]?.version).toBe(APP_VERSION);
		expect(APP_MAJOR_VERSION).toBe(1);
		expect(APP_VERSION_LABEL).toBe("V1");
		expect(APP_BUILD_VERSION.startsWith(`${APP_VERSION}+`)).toBe(true);
		expect(APP_BUILD_VERSION.length).toBeGreaterThan(APP_VERSION.length + 1);
	});

	it("keeps the API contract version independent", () => {
		expect(BLENDCALC_API_V1).toMatch(/^1\.\d+$/);
		expect(BLENDCALC_API_V1).not.toBe(APP_VERSION);
		expect(openAPI.info.version.startsWith(`${BLENDCALC_API_V1}.`)).toBe(true);
		expect(openAPI.info["x-blendcalc-status"]).toBe("internal");
		expect(openAPI.info["x-blendcalc-access"]).toBe("internal-authenticated");
		expect(openAPI.info["x-blendcalc-public-release"]).toBe(
			"blocked-pending-professional-terms-review",
		);
		expect(
			Object.keys(openAPI.paths).every((path) => path.startsWith("/api/v1/")),
		).toBe(true);
	});

	it("exposes app release and build identity globally", () => {
		expect(appLayout).toContain('name="application-version"');
		expect(appLayout).toContain('name="application-build"');
		expect(serverHook).toContain('"x-blendcalc-app-version"');
		expect(serverHook).toContain('"x-blendcalc-app-build"');
	});

	it("does not leave literal product versions in outbound scripts", () => {
		const scriptFiles = [
			"scripts/audits/food-sources/audit_barcode_provider_experience.mjs",
			"scripts/backfills/images/backfill_food_images.mjs",
			"scripts/backfills/catalog/backfill_shared_product_categories.mjs",
			"scripts/audits/food-sources/benchmark_product_sources.mjs",
			"scripts/generators/api/generate_api_structures.mjs",
			"scripts/seeds/catalog/seed_custom_food_categories.mjs",
			"scripts/seeds/food-safety/seed_food_preference_api_observations.mjs",
			"scripts/seeds/nutrition/seed_manual_entry_nutrients.mjs",
		];
		for (const file of scriptFiles) {
			expect(readFileSync(file, "utf8")).not.toMatch(/blendCalc\/\d+\.\d+/);
		}
	});
});
