// Generate reference-only TypeScript views of the external API payloads the app reads.
// These files document observed payload shape only. Runtime app types belong in src/.

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fetch from "node-fetch";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
config({ path: path.join(projectRoot, ".env.moderation.local"), quiet: true });
config({ path: path.join(projectRoot, ".env"), quiet: true });

const FDC_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OPEN_FOOD_FACTS_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const OUTPUT_DIRECTORY = path.join(projectRoot, "docs", "api-structures");
const DEFAULT_SAMPLE_LIMIT = 3;
const MAX_QUERY_READS = 24;
const MAX_ARRAY_SAMPLES = 50;

const fdcApiKey = process.env.VITE_FDC_API_KEY;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const parsePositiveInteger = (value, fallback, label) => {
	const parsed = Number.parseInt(value ?? "", 10);
	if (Number.isInteger(parsed) && parsed > 0) return parsed;
	if (value === undefined || value === "") return fallback;
	throw new Error(`${label} must be a positive integer.`);
};

const parseArguments = (argumentsList) => {
	const options = {
		queries: [],
		sampleLimit: DEFAULT_SAMPLE_LIMIT,
	};

	for (const argument of argumentsList) {
		if (!argument.startsWith("--")) {
			options.queries.push(argument);
			continue;
		}

		const [flag, ...rawValueParts] = argument.slice(2).split("=");
		const value = rawValueParts.join("=");

		switch (flag) {
			case "query":
				if (value) options.queries.push(value);
				break;
			case "samples":
				options.sampleLimit = parsePositiveInteger(value, DEFAULT_SAMPLE_LIMIT, "samples");
				break;
			default:
				throw new Error(`Unknown option: --${flag}`);
		}
	}

	return options;
};

const createSupabaseClient = () => {
	if (!supabaseUrl || !serviceRoleKey) return null;
	return createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
		realtime: {
			transport: WebSocket,
		},
	});
};

const uniqueValues = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const normalized = String(value ?? "").trim();
		const key = normalized.toLocaleLowerCase();
		if (!normalized || seen.has(key)) return [];
		seen.add(key);
		return [normalized];
	});
};

const getObservedQueries = async (explicitQueries, sampleLimit) => {
	if (explicitQueries.length > 0) return uniqueValues(explicitQueries).slice(0, sampleLimit);

	const supabase = createSupabaseClient();
	if (!supabase) {
		throw new Error(
			"No explicit query terms were provided and Supabase env vars are missing. Pass --query=\"milk\" or configure PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
		);
	}

	const querySources = [
		supabase
			.from("custom_food_category_observations")
			.select("query")
			.order("last_seen_at", { ascending: false })
			.limit(MAX_QUERY_READS),
		supabase
			.from("nutrient_manual_entry_observations")
			.select("query")
			.order("last_seen_at", { ascending: false })
			.limit(MAX_QUERY_READS),
		supabase
			.from("food_preference_api_observations")
			.select("query")
			.order("last_seen_at", { ascending: false })
			.limit(MAX_QUERY_READS),
	];

	const results = await Promise.allSettled(querySources);
	const observedQueries = results.flatMap((result) => {
		if (result.status === "rejected" || result.value.error) return [];
		return (result.value.data ?? []).map((row) => row.query);
	});

	const queries = uniqueValues(observedQueries).slice(0, sampleLimit);
	if (queries.length === 0) {
		throw new Error(
			"No observed API query terms were found in Supabase. Run the seed scripts or pass --query values.",
		);
	}
	return queries;
};

const fetchJson = async (url, options = {}, label = "API request") => {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
	}
	return await response.json();
};

const buildFdcSearchUrl = (query) => {
	if (!fdcApiKey || fdcApiKey === "your_api_key_here") {
		throw new Error("VITE_FDC_API_KEY is required to generate FoodData Central structures.");
	}

	const url = new URL(`${FDC_BASE_URL}/foods/search`);
	url.searchParams.set("api_key", fdcApiKey);
	url.searchParams.set("query", query);
	url.searchParams.set("pageSize", "5");
	url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");
	return url;
};

const buildFdcDetailUrl = (fdcId) => {
	const url = new URL(`${FDC_BASE_URL}/food/${fdcId}`);
	url.searchParams.set("api_key", fdcApiKey);
	return url;
};

const fetchFdcSamples = async (queries) => {
	const searchResponses = [];
	const detailResponses = [];

	for (const query of queries) {
		const searchResponse = await fetchJson(
			buildFdcSearchUrl(query),
			{},
			`FoodData Central search for "${query}"`,
		);
		searchResponses.push(searchResponse);

		const fdcIds = uniqueValues(
			(searchResponse.foods ?? [])
				.map((food) => food.fdcId)
				.filter(Boolean),
		).slice(0, 2);

		for (const fdcId of fdcIds) {
			detailResponses.push(
				await fetchJson(
					buildFdcDetailUrl(fdcId),
					{},
					`FoodData Central detail for ${fdcId}`,
				),
			);
		}
	}

	return { searchResponses, detailResponses };
};

const buildOpenFoodFactsSearchUrl = (query) => {
	const url = new URL(OPEN_FOOD_FACTS_SEARCH_URL);
	url.searchParams.set("search_terms", query);
	url.searchParams.set("search_simple", "1");
	url.searchParams.set("action", "process");
	url.searchParams.set("json", "1");
	url.searchParams.set("page_size", "5");
	return url;
};

const fetchOpenFoodFactsSamples = async (queries) => {
	const searchResponses = [];
	const productResponses = [];

	for (const query of queries) {
		const searchResponse = await fetchJson(
			buildOpenFoodFactsSearchUrl(query),
			{
				headers: {
					accept: "application/json",
					"user-agent": "SmoothieMixer/1.0 (API structure reference generator)",
				},
			},
			`Open Food Facts search for "${query}"`,
		);
		searchResponses.push(searchResponse);

		const productCodes = uniqueValues(
			(searchResponse.products ?? [])
				.map((product) => product.code)
				.filter(Boolean),
		).slice(0, 2);

		for (const productCode of productCodes) {
			productResponses.push(
				await fetchJson(
					`${OPEN_FOOD_FACTS_PRODUCT_URL}/${encodeURIComponent(productCode)}.json`,
					{
						headers: {
							accept: "application/json",
							"user-agent": "SmoothieMixer/1.0 (API structure reference generator)",
						},
					},
					`Open Food Facts product ${productCode}`,
				),
			);
		}
	}

	return { searchResponses, productResponses };
};

const getKind = (value) => {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
};

const createEmptySchema = () => ({
	kinds: new Set(),
	samples: 0,
	properties: new Map(),
	itemSchema: null,
});

const mergeSchemas = (target, source) => {
	for (const kind of source.kinds) target.kinds.add(kind);
	target.samples += source.samples;

	for (const [key, propertySchema] of source.properties) {
		const existing = target.properties.get(key);
		if (existing) {
			existing.seen += propertySchema.seen;
			mergeSchemas(existing.schema, propertySchema.schema);
		} else {
			target.properties.set(key, {
				seen: propertySchema.seen,
				schema: propertySchema.schema,
			});
		}
	}

	if (source.itemSchema) {
		if (!target.itemSchema) target.itemSchema = createEmptySchema();
		mergeSchemas(target.itemSchema, source.itemSchema);
	}

	return target;
};

const inferSchema = (value) => {
	const schema = createEmptySchema();
	schema.samples = 1;
	const kind = getKind(value);
	schema.kinds.add(kind);

	if (kind === "object") {
		for (const [key, propertyValue] of Object.entries(value)) {
			schema.properties.set(key, {
				seen: 1,
				schema: inferSchema(propertyValue),
			});
		}
	}

	if (kind === "array") {
		const values = value.slice(0, MAX_ARRAY_SAMPLES);
		const itemSchema = createEmptySchema();
		for (const item of values) mergeSchemas(itemSchema, inferSchema(item));
		schema.itemSchema = itemSchema;
	}

	return schema;
};

const inferMergedSchema = (samples) => {
	const schema = createEmptySchema();
	for (const sample of samples) mergeSchemas(schema, inferSchema(sample));
	return schema;
};

const isValidIdentifier = (value) => /^[A-Za-z_$][\w$]*$/.test(value);

const renderPropertyName = (value) =>
	isValidIdentifier(value) ? value : JSON.stringify(value);

const sortProperties = (properties) =>
	[...properties.entries()].sort(([left], [right]) => left.localeCompare(right));

const renderSchema = (schema, indentLevel = 0) => {
	const indentation = "\t".repeat(indentLevel);
	const childIndentation = "\t".repeat(indentLevel + 1);
	const typeParts = [];

	if (schema.kinds.has("string")) typeParts.push("string");
	if (schema.kinds.has("number")) typeParts.push("number");
	if (schema.kinds.has("boolean")) typeParts.push("boolean");
	if (schema.kinds.has("undefined")) typeParts.push("undefined");
	if (schema.kinds.has("function")) typeParts.push("unknown");
	if (schema.kinds.has("symbol")) typeParts.push("unknown");
	if (schema.kinds.has("bigint")) typeParts.push("bigint");
	if (schema.kinds.has("null")) typeParts.push("null");

	if (schema.kinds.has("array")) {
		const itemType = schema.itemSchema?.samples
			? renderSchema(schema.itemSchema, indentLevel)
			: "unknown";
		typeParts.push(`Array<${itemType}>`);
	}

	if (schema.kinds.has("object")) {
		if (schema.properties.size === 0) {
			typeParts.push("Record<string, never>");
		} else {
			const properties = sortProperties(schema.properties).map(([key, property]) => {
				const optional = property.seen < schema.samples ? "?" : "";
				return `${childIndentation}${renderPropertyName(key)}${optional}: ${renderSchema(
					property.schema,
					indentLevel + 1,
				)};`;
			});
			typeParts.push(`{\n${properties.join("\n")}\n${indentation}}`);
		}
	}

	return [...new Set(typeParts)].join(" | ") || "unknown";
};

const renderTypeAlias = (name, samples) =>
	`export type ${name} = ${renderSchema(inferMergedSchema(samples))};\n`;

const createHeader = (apiName, queries) => `/* eslint-disable */
/**
 * GENERATED REFERENCE FILE — DO NOT IMPORT IN APP CODE.
 *
 * API: ${apiName}
 * Generated by: scripts/generate_api_structures.mjs
 * Query source: observed Supabase API seed data, unless explicit --query values were passed.
 * Sample queries: ${queries.join(", ")}
 *
 * Purpose:
 * - Document every field observed in sampled external API responses.
 * - Help future refactors understand vendor payload shape before creating app-owned types.
 *
 * Runtime rule:
 * - These reference types are documentation only.
 * - If app code needs importable types, create curated runtime types under src/lib/types
 *   or the relevant src/lib/utils domain instead of importing this file.
 */

`;

const writeReferenceFile = async (fileName, content) => {
	await writeFile(path.join(OUTPUT_DIRECTORY, fileName), content);
};

const writeReadme = async () => {
	await writeReferenceFile(
		"README.md",
		`# API Structures

This folder contains generated reference files that describe the external food API payloads observed by Smoothie Mixer scripts.

These files are documentation only. Do not import them from app code.

If runtime code needs types, create focused app-owned types in \`src/lib/types\` or the relevant \`src/lib/utils/**\` module. Runtime types should model what the app actually consumes, not every field a vendor may return.

The generator does not seed or mutate Supabase. It reads existing observed query terms when Supabase script credentials are available, calls the external APIs, and writes local documentation files.

## Regenerate

\`\`\`bash
npm run generate:api-structures
\`\`\`

The generator uses existing Supabase API-observation tables for sample queries. You can pass explicit query terms for targeted inspection:

\`\`\`bash
npm run generate:api-structures -- --query="almond milk" --query="protein bar" --samples=2
\`\`\`

## Current coverage

- USDA FoodData Central search responses
- USDA FoodData Central food detail responses
- Open Food Facts search responses
- Open Food Facts product detail responses

These files represent observed response shapes from sampled payloads, not a vendor-guaranteed complete contract.

When new external food APIs are added to the app, update \`scripts/generate_api_structures.mjs\` so this folder continues to reflect every active external data source.
`,
	);
};

const main = async () => {
	const options = parseArguments(process.argv.slice(2));
	const queries = await getObservedQueries(options.queries, options.sampleLimit);
	await mkdir(OUTPUT_DIRECTORY, { recursive: true });

	console.log(`Generating API structure references from ${queries.length} observed queries.`);
	console.log(`Queries: ${queries.join(", ")}`);

	const [fdcSamples, openFoodFactsSamples] = await Promise.all([
		fetchFdcSamples(queries),
		fetchOpenFoodFactsSamples(queries),
	]);

	await writeReferenceFile(
		"food-data-central.reference.ts",
		[
			createHeader("USDA FoodData Central", queries),
			renderTypeAlias("FoodDataCentralSearchResponse", fdcSamples.searchResponses),
			renderTypeAlias("FoodDataCentralFoodDetailResponse", fdcSamples.detailResponses),
		].join("\n"),
	);

	await writeReferenceFile(
		"open-food-facts.reference.ts",
		[
			createHeader("Open Food Facts", queries),
			renderTypeAlias("OpenFoodFactsSearchResponse", openFoodFactsSamples.searchResponses),
			renderTypeAlias("OpenFoodFactsProductResponse", openFoodFactsSamples.productResponses),
		].join("\n"),
	);

	await writeReferenceFile(
		"api-structure-summary.json",
		`${JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				querySource:
					options.queries.length > 0
						? "explicit-script-arguments"
						: "supabase-api-observation-tables",
				queries,
				endpoints: {
					foodDataCentral: [
						`${FDC_BASE_URL}/foods/search`,
						`${FDC_BASE_URL}/food/{fdcId}`,
					],
					openFoodFacts: [
						OPEN_FOOD_FACTS_SEARCH_URL,
						`${OPEN_FOOD_FACTS_PRODUCT_URL}/{barcode}.json`,
					],
				},
				sampleCounts: {
					foodDataCentralSearch: fdcSamples.searchResponses.length,
					foodDataCentralDetail: fdcSamples.detailResponses.length,
					openFoodFactsSearch: openFoodFactsSamples.searchResponses.length,
					openFoodFactsProduct: openFoodFactsSamples.productResponses.length,
				},
			},
			null,
			2,
		)}\n`,
	);

	await writeReadme();
	console.log(`Wrote API structure references to ${path.relative(projectRoot, OUTPUT_DIRECTORY)}.`);
};

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
