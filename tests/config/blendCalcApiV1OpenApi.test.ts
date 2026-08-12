import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_V1_ERROR_DEFINITIONS } from "$lib/api/v1/errors";
import { BLENDCALC_API_V1_ACCESS_POLICY } from "$lib/api/v1/accessPolicy";

const specification = JSON.parse(
	readFileSync("static/api/v1/openapi.json", "utf8"),
) as {
	openapi: string;
	info: {
		"x-blendcalc-status": string;
		"x-blendcalc-access": string;
		"x-blendcalc-public-release": string;
	};
	paths: Record<string, Record<string, unknown>>;
	components: {
		responses: Record<string, unknown>;
		schemas: Record<string, unknown>;
		securitySchemes: Record<string, unknown>;
	};
};

describe("blendCalc API v1 OpenAPI contract", () => {
	it("publishes the four read-only internal endpoints", () => {
		expect(specification.openapi).toBe("3.1.0");
		expect(Object.keys(specification.paths)).toEqual([
			"/api/v1/products/{barcode}",
			"/api/v1/products/{barcode}/revisions",
			"/api/v1/foods/search",
			"/api/v1/categories",
		]);
		for (const path of Object.values(specification.paths)) {
			expect(Object.keys(path)).toEqual(["get"]);
		}
	});

	it("documents internal authentication and safe public fields", () => {
		expect(BLENDCALC_API_V1_ACCESS_POLICY).toMatchObject({
			accessMode: "internal-authenticated",
			publicAccessEnabled: false,
			publicReleaseStatus: "blocked-pending-professional-terms-review",
			professionalTermsReview: { status: "pending" },
		});
		expect(specification.info).not.toHaveProperty("termsOfService");
		expect(specification.info).toMatchObject({
			"x-blendcalc-status": "internal",
			"x-blendcalc-access": BLENDCALC_API_V1_ACCESS_POLICY.accessMode,
			"x-blendcalc-public-release":
				BLENDCALC_API_V1_ACCESS_POLICY.publicReleaseStatus,
		});
		expect(specification.components.securitySchemes).toHaveProperty("cookieAuth");
		expect(specification.components.schemas).toHaveProperty("Source");
		expect(specification.components.schemas).toHaveProperty("FieldSource");
		expect(specification.components.schemas).toHaveProperty("Revision");
		expect(specification.components.schemas).toHaveProperty(
			"ProductRevisionChange",
		);
		expect(specification.components.schemas).toHaveProperty(
			"ProductRevisionHistoryItem",
		);
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
		expect(specification.components.schemas).toHaveProperty("CatalogMetadata");
		expect(specification.components.schemas).toHaveProperty(
			"CompatibilityEvaluation",
		);
	});

	it("identifies shared catalog authority and field-level attribution", () => {
		const serialized = JSON.stringify(specification);
		expect(serialized).toContain("blendcalc-shared-catalog");
		expect(serialized).toContain("redistributionPolicy");
		expect(serialized).toContain("sourceAttributions");
		expect(serialized).toContain("fieldSources");
		expect(serialized).toContain("observationId");
		expect(serialized).toContain("corroborated-sources");
		expect(serialized).toContain("sourceType");
		expect(serialized).toContain("compatibilityEvaluation");
		expect(serialized).toContain("not_checked");
		expect(serialized).toContain("packaged-label");
		expect(serialized).toContain("unknown-identity");
	});

	it("requires complete source, dataset, and image attribution metadata", () => {
		expect(specification.components.schemas.SourceAttribution).toMatchObject({
			required: expect.arrayContaining([
				"source",
				"displayName",
				"sourceUrl",
				"licenseName",
				"licenseUrl",
				"attribution",
				"redistributionPolicyReviewedAt",
				"dataset",
			]),
		});
		expect(specification.components.schemas.Product).toMatchObject({
			properties: {
				sourceAttributions: { type: "array", minItems: 1 },
			},
		});
		expect(specification.components.schemas.Image).toMatchObject({
			required: expect.arrayContaining(["license", "source", "retrievedAt"]),
			properties: {
				license: {
					required: ["name", "url", "attribution"],
					properties: {
						url: { type: "string", format: "uri" },
						attribution: { type: "string" },
					},
				},
			},
		});
	});

	it("never documents private storage or moderation fields", () => {
		const serialized = JSON.stringify(specification);
		for (const privateField of [
			"storagePath",
			"storage_path",
			"evidencePath",
			"approvedBy",
			"approved_by",
			"reviewedBy",
			"submittedBy",
			"userId",
			"ownerId",
			"moderationEvidence",
			"packageInstance",
			"lotCode",
			"serialNumber",
			"expirationDate",
		]) {
			expect(serialized).not.toContain(`"${privateField}"`);
		}
	});

	it("allows only bounded public revision values and source tag fields", () => {
		expect(specification.components.schemas.ProductRevisionValue).toMatchObject({
			oneOf: expect.any(Array),
		});
		expect(specification.components.schemas.SourceRecord).toMatchObject({
			properties: {
				tagSources: {
					additionalProperties: false,
					properties: expect.objectContaining({
						allergens: expect.any(Object),
						ingredients: expect.any(Object),
					}),
				},
			},
		});
	});

	it("closes every public response envelope to undocumented fields", () => {
		for (const name of [
			"ProductResponse",
			"ProductListResponse",
			"ProductRevisionListResponse",
			"CategoryListResponse",
			"ErrorResponse",
		]) {
			expect(specification.components.schemas[name]).toMatchObject({
				type: "object",
				additionalProperties: false,
			});
		}
	});

	it("documents every stable error code and boundary status", () => {
		const errorResponse = specification.components.schemas.ErrorResponse as {
			properties: {
				error: {
					properties: { code: { enum: string[] } };
				};
			};
		};
		expect(errorResponse.properties.error.properties.code.enum).toEqual(
			Object.keys(API_V1_ERROR_DEFINITIONS),
		);
		expect(specification.components.responses).toEqual(
			expect.objectContaining({
				Forbidden: expect.any(Object),
				MethodNotAllowed: expect.any(Object),
				RateLimited: expect.any(Object),
				UnexpectedError: expect.any(Object),
			}),
		);
		for (const operation of Object.values(specification.paths)) {
			const get = operation.get as { responses: Record<string, unknown> };
			expect(Object.keys(get.responses)).toEqual(
				expect.arrayContaining(["400", "401", "403", "405", "429", "500", "503"]),
			);
		}
	});
});
