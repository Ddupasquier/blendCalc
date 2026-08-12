import { readFileSync } from "node:fs";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

type OpenApiOperation = {
	responses: Record<string, OpenApiResponse | OpenApiReference>;
};

type OpenApiReference = { $ref: string };

type OpenApiResponse = {
	content?: {
		"application/json"?: {
			schema?: Record<string, unknown>;
		};
	};
};

type OpenApiSpecification = {
	components: {
		responses: Record<string, OpenApiResponse>;
		schemas: Record<string, Record<string, unknown>>;
	};
	paths: Record<string, Record<string, OpenApiOperation>>;
};

const specification = JSON.parse(
	readFileSync("static/api/v1/openapi.json", "utf8"),
) as OpenApiSpecification;

const validator = new Ajv2020({ allErrors: true, strict: true });
addFormats(validator);

for (const [name, schema] of Object.entries(specification.components.schemas)) {
	validator.addSchema(schema, `#/components/schemas/${name}`);
}

const isReference = (
	response: OpenApiResponse | OpenApiReference,
): response is OpenApiReference => "$ref" in response;

const resolveResponse = (
	response: OpenApiResponse | OpenApiReference,
): OpenApiResponse => {
	if (!isReference(response)) return response;
	const prefix = "#/components/responses/";
	if (!response.$ref.startsWith(prefix)) {
		throw new Error(`Unsupported OpenAPI response reference: ${response.$ref}`);
	}
	const resolved = specification.components.responses[response.$ref.slice(prefix.length)];
	if (!resolved) throw new Error(`Missing OpenAPI response: ${response.$ref}`);
	return resolved;
};

const formatValidationErrors = (errors: ErrorObject[] | null | undefined) =>
	(errors ?? [])
		.map(({ instancePath, message, params }) =>
			`${instancePath || "/"} ${message ?? "is invalid"} ${JSON.stringify(params)}`,
		)
		.join("\n");

export const expectApiV1ResponseToMatchOpenApi = async ({
	method = "get",
	path,
	response,
}: {
	method?: string;
	path: string;
	response: Response;
}) => {
	const operation = specification.paths[path]?.[method];
	if (!operation) throw new Error(`OpenAPI operation not found: ${method.toUpperCase()} ${path}`);
	const declaredResponse = operation.responses[String(response.status)];
	if (!declaredResponse) {
		throw new Error(`OpenAPI does not document HTTP ${response.status} for ${method.toUpperCase()} ${path}`);
	}
	const schema = resolveResponse(declaredResponse).content?.["application/json"]?.schema;
	if (!schema) throw new Error(`JSON schema not found for ${method.toUpperCase()} ${path} HTTP ${response.status}`);

	const payload = await response.clone().json();
	const validate = validator.compile(schema);
	if (!validate(payload)) {
		throw new Error(
			`Response drift for ${method.toUpperCase()} ${path} HTTP ${response.status}:\n${formatValidationErrors(validate.errors)}`,
		);
	}

	return payload;
};
