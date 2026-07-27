import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const specification = JSON.parse(
	readFileSync("static/api/v1/openapi.json", "utf8"),
) as {
	openapi: string;
	paths: Record<string, Record<string, unknown>>;
	components: {
		schemas: Record<string, unknown>;
		securitySchemes: Record<string, unknown>;
	};
};

describe("blendCalc API v1 OpenAPI contract", () => {
	it("publishes the three read-only internal endpoints", () => {
		expect(specification.openapi).toBe("3.1.0");
		expect(Object.keys(specification.paths)).toEqual([
			"/api/v1/products/{barcode}",
			"/api/v1/foods/search",
			"/api/v1/categories",
		]);
		for (const path of Object.values(specification.paths)) {
			expect(Object.keys(path)).toEqual(["get"]);
		}
	});

	it("documents internal authentication and safe public fields", () => {
		expect(specification.components.securitySchemes).toHaveProperty("cookieAuth");
		expect(specification.components.schemas).toHaveProperty("Source");
		expect(specification.components.schemas).toHaveProperty("Revision");
		expect(specification.components.schemas).toHaveProperty("Serving");
		expect(specification.components.schemas).toHaveProperty("Image");
		expect(specification.components.schemas).toHaveProperty(
			"StructuredIngredient",
		);
		expect(specification.components.schemas).toHaveProperty(
			"IngredientAnalysis",
		);
		expect(specification.components.schemas).toHaveProperty("PackageQuantity");
		expect(specification.components.schemas).toHaveProperty("SourceRecord");
	});

	it("never documents private storage or moderation fields", () => {
		const serialized = JSON.stringify(specification);
		expect(serialized).not.toContain("storagePath");
		expect(serialized).not.toContain("storage_path");
		expect(serialized).not.toContain("approvedBy");
		expect(serialized).not.toContain("approved_by");
		expect(serialized).not.toContain("moderationEvidence");
	});
});
