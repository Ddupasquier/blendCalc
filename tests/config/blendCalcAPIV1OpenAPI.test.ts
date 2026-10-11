import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLENDCALC_API_V1_ERROR_DEFINITIONS } from "$lib/blendCalcAPI/v1/blendCalcAPIErrors";
import { BLENDCALC_API_V1_ACCESS_POLICY } from "$lib/blendCalcAPI/v1/blendCalcAPIAccessPolicy";
import {
	BLENDCALC_API_V1_PAGINATION_LIMITS,
	readBlendCalcAPIV1BarcodePathParameter,
	readBlendCalcAPIV1CategoryRequest,
	readBlendCalcAPIV1SearchRequest,
} from "$lib/blendCalcAPI/v1/blendCalcAPIRequest";
import type {
	BlendCalcAPIV1Category,
	BlendCalcAPIV1Product,
	BlendCalcAPIV1Success,
} from "$lib/blendCalcAPI/v1/blendCalcAPITypes";
import { expectBlendCalcAPIV1ResponseToMatchOpenAPI } from "../lib/blendCalcAPI/v1/openAPIResponseValidation";

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

describe("blendCalcAPI v1 OpenAPI contract", () => {
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

	it("exposes no upload or mutable request-body contract", () => {
		for (const path of Object.values(specification.paths)) {
			expect(Object.keys(path)).toEqual(["get"]);
			expect(path.get).not.toHaveProperty("requestBody");
		}
		const serialized = JSON.stringify(specification);
		expect(serialized).not.toContain("multipart/form-data");
		expect(serialized).not.toContain("application/octet-stream");
		expect(serialized).not.toContain('"format":"binary"');
	});

	it("keeps documented pagination aligned with runtime limits", () => {
		const readQueryParameter = (path: string, name: string) => {
			const operation = specification.paths[path]?.get as {
				parameters: Array<{
					name: string;
					schema: { default: number; maximum: number; minimum: number };
				}>;
			};
			return operation.parameters.find((parameter) => parameter.name === name)
				?.schema;
		};

		expect(readQueryParameter("/api/v1/foods/search", "limit")).toEqual({
			type: "integer",
			minimum: 1,
			maximum: BLENDCALC_API_V1_PAGINATION_LIMITS.search.maximumLimit,
			default: BLENDCALC_API_V1_PAGINATION_LIMITS.search.defaultLimit,
		});
		expect(readQueryParameter("/api/v1/categories", "limit")).toEqual({
			type: "integer",
			minimum: 1,
			maximum: BLENDCALC_API_V1_PAGINATION_LIMITS.categories.maximumLimit,
			default: BLENDCALC_API_V1_PAGINATION_LIMITS.categories.defaultLimit,
		});
		expect(
			readQueryParameter("/api/v1/products/{barcode}/revisions", "limit"),
		).toEqual({
			type: "integer",
			minimum: 1,
			maximum: BLENDCALC_API_V1_PAGINATION_LIMITS.revisions.maximumLimit,
			default: BLENDCALC_API_V1_PAGINATION_LIMITS.revisions.defaultLimit,
		});
		for (const path of [
			"/api/v1/foods/search",
			"/api/v1/categories",
			"/api/v1/products/{barcode}/revisions",
		]) {
			expect(readQueryParameter(path, "offset")).toEqual({
				type: "integer",
				minimum: 0,
				maximum: BLENDCALC_API_V1_PAGINATION_LIMITS.maximumOffset,
				default: 0,
			});
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
		expect(specification.components.securitySchemes).toHaveProperty(
			"cookieAuth",
		);
		for (const schema of [
			"Source",
			"FieldSource",
			"Revision",
			"ProductRevisionChange",
			"ProductRevisionHistoryItem",
			"Serving",
			"Image",
			"StructuredIngredient",
			"IngredientAnalysis",
			"PackageQuantity",
			"AlcoholByVolume",
			"RegulatoryDisclosure",
			"SourceRecord",
			"CatalogMetadata",
			"CompatibilityEvaluation",
		]) {
			expect(specification.components.schemas).toHaveProperty(schema);
		}
	});

	it("identifies shared catalog authority and field-level attribution", () => {
		const serialized = JSON.stringify(specification);
		for (const field of [
			"blendcalc-shared-catalog",
			"redistributionPolicy",
			"sourceAttributions",
			"fieldSources",
			"observationId",
			"corroborated-sources",
			"sourceType",
			"compatibilityEvaluation",
			"not_checked",
			"packaged-label",
			"unknown-identity",
		]) {
			expect(serialized).toContain(field);
		}
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
			properties: { sourceAttributions: { type: "array", minItems: 1 } },
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
		expect(specification.components.schemas.ProductRevisionValue).toMatchObject(
			{
				oneOf: expect.any(Array),
			},
		);
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
			properties: { error: { properties: { code: { enum: string[] } } } };
		};
		expect(errorResponse.properties.error.properties.code.enum).toEqual(
			Object.keys(BLENDCALC_API_V1_ERROR_DEFINITIONS),
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
				expect.arrayContaining([
					"400",
					"401",
					"403",
					"405",
					"429",
					"500",
					"503",
				]),
			);
		}
	});
});

const documentationExamples = JSON.parse(
	readFileSync("docs/development/blendCalcAPI/response-examples.json", "utf8"),
) as Array<{
	id: string;
	request: string;
	path: string;
	status: number;
	headers?: Record<string, string>;
	body: unknown;
}>;

const readDocumentationExample = (id: string) => {
	const example = documentationExamples.find((item) => item.id === id);
	if (!example) throw new Error(`Missing API documentation example: ${id}`);
	return example;
};

describe("blendCalcAPI documentation response examples", () => {
	it("accepts the example requests except the deliberately invalid GTIN", () => {
		for (const example of documentationExamples) {
			const [method, target] = example.request.split(" ");
			expect(method).toBe("GET");
			const url = new URL(target, "http://localhost");
			if (example.path === "/api/v1/products/{barcode}") {
				const barcode = url.pathname.slice("/api/v1/products/".length);
				if (example.id === "invalid_barcode") {
					expect(() => readBlendCalcAPIV1BarcodePathParameter(barcode)).toThrow(
						BLENDCALC_API_V1_ERROR_DEFINITIONS.invalid_barcode.message,
					);
				} else {
					expect(readBlendCalcAPIV1BarcodePathParameter(barcode)).toBe(barcode);
				}
			} else if (example.path === "/api/v1/categories") {
				expect(() => readBlendCalcAPIV1CategoryRequest(url)).not.toThrow();
			} else {
				expect(example.path).toBe("/api/v1/foods/search");
				expect(() => readBlendCalcAPIV1SearchRequest(url)).not.toThrow();
			}
		}
	});

	it.each(documentationExamples)(
		"validates $id against its HTTP contract",
		async (example) => {
			await expectBlendCalcAPIV1ResponseToMatchOpenAPI({
				path: example.path,
				response: new Response(JSON.stringify(example.body), {
					status: example.status,
					headers: example.headers,
				}),
			});
		},
	);

	it("keeps reported zero, unknown optional nutrition and personal compatibility distinct", () => {
		const { data } = readDocumentationExample("published-core-optional-unknown")
			.body as BlendCalcAPIV1Success<BlendCalcAPIV1Product>;
		expect(
			data.nutrients.find((nutrient) => nutrient.number === "606"),
		).toMatchObject({
			amountPer100g: 0,
			valueStatus: "reported",
			quality: { sourceValueStatus: "reported-zero" },
		});
		expect(data.nutrients.some((nutrient) => nutrient.id === 1114)).toBe(false);
		expect(data.compatibilityEvaluation).toMatchObject({
			status: "not_checked",
			profileApplied: false,
		});
	});

	it("exposes the same safe response for absent and withheld products", () => {
		const absent = readDocumentationExample("absent-product");
		for (const id of [
			"incomplete-required-evidence",
			"unresolved-material-conflict",
		]) {
			const withheld = readDocumentationExample(id);
			expect(withheld.status).toBe(absent.status);
			expect(withheld.body).toEqual(absent.body);
		}
	});

	it("uses the next offset to finish a stable, nonoverlapping example result set", () => {
		const first = readDocumentationExample("categories-first-page")
			.body as BlendCalcAPIV1Success<BlendCalcAPIV1Category[]>;
		const last = readDocumentationExample("categories-last-page")
			.body as BlendCalcAPIV1Success<BlendCalcAPIV1Category[]>;
		expect(first.meta!.pagination.nextOffset).toBe(
			last.meta!.pagination.offset,
		);
		expect(last.meta!.pagination).toMatchObject({
			hasMore: false,
			nextOffset: null,
		});
		const ids = [...first.data, ...last.data].map((category) => category.id);
		expect(new Set(ids).size).toBe(first.meta!.pagination.total);
		expect(ids).toHaveLength(last.meta!.pagination.total);
	});

	it("keeps every illustrated error aligned with the runtime definition", () => {
		for (const example of documentationExamples.filter(
			(item) => item.status >= 400,
		)) {
			const { error } = example.body as {
				error: {
					code: keyof typeof BLENDCALC_API_V1_ERROR_DEFINITIONS;
					message: string;
				};
			};
			expect(BLENDCALC_API_V1_ERROR_DEFINITIONS[error.code]).toEqual({
				status: example.status,
				message: error.message,
			});
		}
	});
});
