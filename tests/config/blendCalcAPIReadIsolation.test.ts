import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSources = [
	"src/lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server.ts",
	"src/lib/server/blendCalcAPI/v1/blendCalcAPIReadModel.server.ts",
	"src/lib/server/blendCalcAPI/v1/blendCalcAPIIsolatedCatalog.server.ts",
	"src/routes/api/v1/products/[barcode]/+server.ts",
	"src/routes/api/v1/products/[barcode]/revisions/+server.ts",
	"src/routes/api/v1/foods/search/+server.ts",
	"src/routes/api/v1/categories/+server.ts",
].map((path) => readFileSync(resolve(path), "utf8"));

describe("blendCalcAPI read-path isolation", () => {
	it("does not make analytics, provider traffic, or intake processing a read dependency", () => {
		for (const source of readSources) {
			expect(source).not.toMatch(
				/analytics|publicationConcerns|externalProduct/,
			);
		}
	});

	it("keeps read endpoints on stored catalog and attribution data", () => {
		expect(readSources.join("\n")).toContain("blendCalcAPICatalog.server");
		expect(readSources.join("\n")).toContain("catalogRead.server");
	});
});
