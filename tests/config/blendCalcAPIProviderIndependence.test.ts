import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BLENDCALC_API_READ_BOUNDARY_FILES = [
	"src/lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server.ts",
	"src/routes/api/v1/categories/+server.ts",
	"src/routes/api/v1/foods/search/+server.ts",
	"src/routes/api/v1/products/[barcode]/+server.ts",
	"src/routes/api/v1/products/[barcode]/revisions/+server.ts",
];

const FORBIDDEN_LIVE_PROVIDER_DEPENDENCIES = [
	"externalProduct.server",
	"productApiRequests.server",
	"productLookup",
	"openFoodFacts",
	"foodDataCentral",
	"colaCloud",
	"https://api.nal.usda.gov",
	"https://world.openfoodfacts.org",
];

describe("blendCalcAPI provider independence", () => {
	it.each(BLENDCALC_API_READ_BOUNDARY_FILES)(
		"keeps %s on stored canonical data",
		(filePath) => {
			const source = readFileSync(filePath, "utf8");

			for (const forbiddenDependency of FORBIDDEN_LIVE_PROVIDER_DEPENDENCIES) {
				expect(source).not.toContain(forbiddenDependency);
			}
			expect(source).not.toMatch(/\bfetch\s*\(/);
		},
	);
});
