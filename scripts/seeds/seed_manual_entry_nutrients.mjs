/**
 * Purpose: Sample USDA and Open Food Facts nutrient metadata, resolve it against canonical
 * nutrient definitions and DB-owned manual-entry policy, store idempotent observations,
 * and rebuild evidence summaries once after all batches. Optional source failures are
 * reported without discarding successful work.
 * Preview: `npm run seed:manual-entry-nutrients -- --dry-run --pages=1 --page-size=25`
 * Execute: `npm run seed:manual-entry-nutrients -- --pages=2 --page-size=50 --concurrency=3`
 * Targeted queries may be appended as quoted positional arguments.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ws from "ws";
import { createAppUserAgent } from "../lib/app_version.mjs";
import { createManualEntryNutrientCatalog } from "../lib/manual_entry_nutrient_catalog.mjs";
import {
	fetchWithRetry,
	runSettledWithConcurrency,
} from "../lib/reference-data/api.mjs";
import { createNutrientDefinitionCatalog } from "../lib/reference-data/nutrientDefinitions.mjs";
import { createSourceNutrientMappingCatalog } from "../lib/source_nutrient_mapping_catalog.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
config({ path: path.join(projectRoot, ".env.moderation.local"), quiet: true });
config({ path: path.join(projectRoot, ".env"), quiet: true });

const FDC_API_KEY = process.env.VITE_FDC_API_KEY;
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OPEN_FOOD_FACTS_PAGE_SIZE = 20;
const APP_USER_AGENT = createAppUserAgent("manual nutrient observation seed");
const DEFAULT_FDC_SOURCE_REQUESTS = [
	{
		source: "fdc-foundation-sr",
		dataTypes: "Foundation,SR Legacy",
	},
	{
		source: "fdc-branded-detail",
		dataTypes: "Branded",
	},
];

const DEFAULT_QUERIES = [
	"whole milk",
	"greek yogurt",
	"cheddar cheese",
	"egg",
	"chicken breast",
	"ground beef",
	"salmon",
	"shrimp",
	"lentils",
	"black beans",
	"almonds",
	"peanut butter",
	"chia seeds",
	"olive oil",
	"oats",
	"whole wheat bread",
	"rice",
	"banana",
	"strawberries",
	"orange juice",
	"spinach",
	"kale",
	"broccoli",
	"sweet potato",
	"protein powder",
	"cereal",
	"candy bar",
	"baby food",
];

const parsePositiveInteger = (value, fallback, label) => {
	const parsed = Number.parseInt(value ?? "", 10);
	if (Number.isInteger(parsed) && parsed > 0) return parsed;
	if (value === undefined) return fallback;
	throw new Error(`${label} must be a positive integer.`);
};

const parseArguments = (argumentsList) => {
	const options = {
		queries: [],
		pages: 2,
		pageSize: 50,
		concurrency: 3,
		dryRun: false,
	};

	for (const argument of argumentsList) {
		if (!argument.startsWith("--")) {
			options.queries.push(argument);
			continue;
		}

		const [flag, ...rawValueParts] = argument.slice(2).split("=");
		const value = rawValueParts.join("=");

		switch (flag) {
			case "pages":
				options.pages = parsePositiveInteger(value, options.pages, "pages");
				break;
			case "page-size":
				options.pageSize = parsePositiveInteger(value, options.pageSize, "page-size");
				break;
			case "concurrency":
				options.concurrency = parsePositiveInteger(value, options.concurrency, "concurrency");
				break;
			case "dry-run":
				options.dryRun = true;
				break;
			default:
				throw new Error(`Unknown option: --${flag}`);
		}
	}

	options.queries = options.queries.length > 0 ? options.queries : DEFAULT_QUERIES;
	return options;
};

const normalizeUnit = (unit) => {
	const normalized = String(unit ?? "").trim().toUpperCase();
	const units = {
		G: "g",
		MG: "mg",
		UG: "mcg",
		µG: "mcg",
		MCG: "mcg",
		KCAL: "kcal",
		KJ: "kJ",
		IU: "IU",
	};
	return units[normalized] ?? String(unit ?? "").trim();
};

const titleCase = (value) =>
	String(value ?? "")
		.toLowerCase()
		.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

const formatDisplayLabel = (name, unit) => {
	const normalizedName = titleCase(String(name ?? "").replace(/, total$/i, ""));
	const normalizedUnit = normalizeUnit(unit);
	return normalizedUnit ? `${normalizedName} (${normalizedUnit})` : normalizedName;
};

const classifyNutrient = ({ nutrientId, nutrientName, unitName, catalog }) => {
	const classification = catalog.resolve(nutrientId);
	if (!classification) return null;
	return {
		...classification,
		displayLabel:
			classification.displayLabel ?? formatDisplayLabel(nutrientName, unitName),
	};
};

const buildSearchUrl = ({ query, pageNumber, pageSize, dataTypes }) => {
	const url = new URL(`${BASE_URL}/foods/search`);
	url.searchParams.set("api_key", FDC_API_KEY);
	url.searchParams.set("query", query);
	url.searchParams.set("pageNumber", String(pageNumber));
	url.searchParams.set("pageSize", String(pageSize));
	url.searchParams.set("dataType", dataTypes);
	return url;
};

const fetchSearchPage = async (request) => {
	const response = await fetchWithRetry(buildSearchUrl(request));
	if (!response.ok) {
		throw new Error(
			`FDC search failed for "${request.query}" page ${request.pageNumber}: ${response.status} ${response.statusText}`,
		);
	}
	const data = await response.json();
	return {
		...request,
		foods: Array.isArray(data.foods) ? data.foods : [],
	};
};

const fetchOpenFoodFactsPage = async (query) => {
	const url = new URL(OPEN_FOOD_FACTS_URL);
	url.searchParams.set("search_terms", query);
	url.searchParams.set("search_simple", "1");
	url.searchParams.set("action", "process");
	url.searchParams.set("json", "1");
	url.searchParams.set("page_size", String(OPEN_FOOD_FACTS_PAGE_SIZE));
	url.searchParams.set("fields", [
		"code",
		"product_name",
		"brands",
		"categories",
		"nutriments",
	].join(","));

	const response = await fetchWithRetry(url, {
		headers: {
			accept: "application/json",
			"user-agent": APP_USER_AGENT,
		},
	});
	if (!response.ok) {
		throw new Error(
			`Open Food Facts nutriment search failed for "${query}": ${response.status} ${response.statusText}`,
		);
	}
	const data = await response.json();
	return {
		query,
		products: Array.isArray(data.products) ? data.products : [],
	};
};

const collectFdcObservations = ({ pages, databaseDefinitions, manualEntryCatalog }) => {
	const nutrientDefinitions = createNutrientDefinitionCatalog(databaseDefinitions);
	const observations = new Map();
	const ignoredNutrients = new Map();

	for (const page of pages) {
		for (const food of page.foods) {
			const foodId = Number(food.fdcId);
			if (!Number.isFinite(foodId)) continue;

			for (const nutrient of food.foodNutrients ?? []) {
				const sourceNutrientId = Number(nutrient.nutrientId);
				const nutrientName = String(nutrient.nutrientName ?? "").trim();
				const nutrientNumber = String(nutrient.nutrientNumber ?? "").trim() || null;
				const unitName = normalizeUnit(nutrient.unitName);
				if (!Number.isFinite(sourceNutrientId) || !nutrientName || !unitName) continue;

				const definition = nutrientDefinitions.resolve(
					sourceNutrientId,
					nutrientNumber,
				) ?? nutrientDefinitions.register({
					nutrient_id: sourceNutrientId,
					nutrient_name: nutrientName,
					nutrient_number: nutrientNumber,
					default_unit_name: unitName,
				});
				if (!definition) continue;

				const classification = classifyNutrient({
					nutrientId: definition.nutrient_id,
					nutrientName: definition.nutrient_name,
					unitName: definition.default_unit_name,
					catalog: manualEntryCatalog,
				});
				if (!classification) {
					ignoredNutrients.set(nutrientName, (ignoredNutrients.get(nutrientName) ?? 0) + 1);
					continue;
				}

				const sourceReference = `${foodId}:${sourceNutrientId}`;
				observations.set(`${page.source}:${page.query}:${sourceReference}`, {
					source: page.source,
					query: page.query,
					source_reference: sourceReference,
					source_food_name: String(food.description ?? "").trim() || null,
					source_data_type: String(food.dataType ?? "").trim() || null,
					nutrient_id: definition.nutrient_id,
					canonical_nutrient_id: classification.canonicalNutrientId,
					nutrient_name: nutrientName,
					nutrient_number: nutrientNumber,
					unit_name: unitName,
					entry_step: classification.entryStep,
					group_id: classification.groupId,
					group_title: classification.groupTitle,
					group_sort_order: classification.groupSortOrder,
					nutrient_type: classification.nutrientType,
					dedupe_key: classification.dedupeKey,
					display_label: classification.displayLabel,
					field_sort_order: classification.fieldSortOrder,
					classification_method: classification.classificationMethod,
					source_payload: {
						fdcId: foodId,
						dataType: food.dataType,
						sourceNutrientId,
						nutrientValue: nutrient.value ?? null,
					},
				});
			}
		}
	}

	return {
		nutrientDefinitions,
		observations,
		ignoredNutrients,
	};
};

const collectOpenFoodFactsObservations = ({
	pages,
	nutrientDefinitions,
	observations,
	manualEntryCatalog,
	sourceMappingCatalog,
}) => {
	const ignoredNutrients = new Map();

	for (const page of pages) {
		for (const product of page.products) {
			const code = String(product.code ?? "").trim();
			if (!code || !product.nutriments) continue;

			for (const [rawKey, rawValue] of Object.entries(product.nutriments)) {
				if (!rawKey.endsWith("_100g")) continue;
				if (!Number.isFinite(Number(rawValue))) continue;

				const sourceNutrientKey = rawKey.replace(/_100g$/i, "");
				const sourceUnitName = product.nutriments[`${sourceNutrientKey}_unit`];
				const mapping = sourceMappingCatalog.resolve({
					sourceNutrientKey,
					sourceUnitName,
				});
				const definition = mapping
					? nutrientDefinitions.get(mapping.nutrient_id)
					: null;

				if (!definition) {
					ignoredNutrients.set(rawKey, (ignoredNutrients.get(rawKey) ?? 0) + 1);
					continue;
				}

				const classification = classifyNutrient({
					nutrientId: definition.nutrient_id,
					nutrientName: definition.nutrient_name,
					unitName: definition.default_unit_name,
					catalog: manualEntryCatalog,
				});
				if (!classification) continue;

				const sourceReference = `${code}:${rawKey}`;
				observations.set(`open-food-facts:${page.query}:${sourceReference}`, {
					source: "open-food-facts",
					query: page.query,
					source_reference: sourceReference,
					source_food_name: String(product.product_name ?? "").trim() || null,
					source_data_type: "Open Food Facts",
					nutrient_id: definition.nutrient_id,
					canonical_nutrient_id: classification.canonicalNutrientId,
					nutrient_name: definition.nutrient_name,
					nutrient_number: definition.nutrient_number,
					unit_name: definition.default_unit_name,
					entry_step: classification.entryStep,
					group_id: classification.groupId,
					group_title: classification.groupTitle,
					group_sort_order: classification.groupSortOrder,
					nutrient_type: classification.nutrientType,
					dedupe_key: classification.dedupeKey,
					display_label: classification.displayLabel,
					field_sort_order: classification.fieldSortOrder,
					classification_method: `${classification.classificationMethod}+off-key-match`,
					source_payload: {
						code,
						productName: product.product_name ?? null,
						brands: product.brands ?? null,
						categories: product.categories ?? null,
						nutrimentKey: rawKey,
						nutrimentUnit: sourceUnitName ?? null,
						nutrimentValue: Number(rawValue),
						mappingPriority: mapping.priority,
						mappingConfidence: mapping.confidence,
					},
				});
			}
		}
	}

	return ignoredNutrients;
};

const upsertInChunks = async ({
	supabase,
	table,
	records,
	chunkSize = 500,
	onConflict,
	ignoreDuplicates = false,
}) => {
	for (let start = 0; start < records.length; start += chunkSize) {
		const chunk = records.slice(start, start + chunkSize);
		const { error } = await supabase
			.from(table)
			.upsert(
				chunk,
				onConflict ? { ignoreDuplicates, onConflict } : undefined,
			);
		if (error) {
			throw new Error(
				`${table} write failed at rows ${start + 1}-${start + chunk.length}: ${error.message}`,
				{ cause: error },
			);
		}
		if (records.length >= 10_000 && (start + chunk.length) % 10_000 === 0) {
			console.log(`${table}: ${start + chunk.length}/${records.length} rows processed`);
		}
	}
};

if (
	!FDC_API_KEY ||
	FDC_API_KEY === "your_api_key_here" ||
	!SUPABASE_URL ||
	!SERVICE_ROLE_KEY
) {
	console.error(
		"Missing VITE_FDC_API_KEY, PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY.",
	);
	process.exit(1);
}

try {
	const options = parseArguments(process.argv.slice(2));
	const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		realtime: { transport: ws },
		auth: { persistSession: false, autoRefreshToken: false },
	});
	const [groupsResult, fieldsResult, definitionsResult, mappingsResult] =
		await Promise.all([
			supabase
				.from("nutrient_manual_entry_groups")
				.select("id, entry_step, title, sort_order, enabled, group_role"),
			supabase
				.from("nutrient_manual_entry_fields")
				.select(
					"nutrient_id, group_id, nutrient_type, display_label, sort_order, enabled, dedupe_key, classification_status, classification_version, replacement_nutrient_id",
				),
			supabase
				.from("nutrient_definitions")
				.select("nutrient_id, nutrient_name, nutrient_number, default_unit_name")
				.limit(5000),
			supabase
				.from("nutrient_source_mappings")
				.select(
					"source_nutrient_key, source_unit_name, nutrient_id, priority, confidence, enabled",
				)
				.eq("source_key", "open-food-facts")
				.limit(5000),
		]);
	for (const result of [
		groupsResult,
		fieldsResult,
		definitionsResult,
		mappingsResult,
	]) {
		if (result.error) throw result.error;
	}
	const manualEntryCatalog = createManualEntryNutrientCatalog({
		groups: groupsResult.data ?? [],
		fields: fieldsResult.data ?? [],
	});
	const sourceMappingCatalog = createSourceNutrientMappingCatalog(
		mappingsResult.data ?? [],
	);
	const requests = options.queries.flatMap((query) =>
		DEFAULT_FDC_SOURCE_REQUESTS.flatMap((sourceRequest) =>
			Array.from({ length: options.pages }, (_, index) => ({
				query,
				source: sourceRequest.source,
				pageNumber: index + 1,
				pageSize: options.pageSize,
				dataTypes: sourceRequest.dataTypes,
			})),
		),
	);

	console.log(
		`Requesting ${requests.length} FDC pages plus Open Food Facts for manual-entry nutrients with concurrency ${options.concurrency}...`,
	);
	const fdcResult = await runSettledWithConcurrency(
		requests,
		options.concurrency,
		fetchSearchPage,
	);
	for (const failure of fdcResult.failures) {
		console.warn(
			`FDC nutrient page was skipped after retries for “${failure.item.query}” page ${failure.item.pageNumber} (${failure.item.source}): ${failure.error.message}`,
		);
	}
	if (fdcResult.values.length === 0) {
		throw new Error("Every FDC nutrient request failed; refusing to record an empty run.");
	}
	const {
		nutrientDefinitions,
		observations,
		ignoredNutrients: ignoredFdcNutrients,
	} = collectFdcObservations({
		pages: fdcResult.values,
		databaseDefinitions: definitionsResult.data ?? [],
		manualEntryCatalog,
	});
	const openFoodFactsResult = await runSettledWithConcurrency(
		options.queries,
		Math.min(options.concurrency, 2),
		fetchOpenFoodFactsPage,
	);
	for (const failure of openFoodFactsResult.failures) {
		console.warn(
			`Open Food Facts nutrient query was skipped after retries for “${failure.item}”: ${failure.error.message}`,
		);
	}
	const ignoredOpenFoodFactsNutrients = collectOpenFoodFactsObservations({
		pages: openFoodFactsResult.values,
		nutrientDefinitions,
		observations,
		manualEntryCatalog,
		sourceMappingCatalog,
	});
	const nutrientDefinitionRows = [...nutrientDefinitions.values()];
	const observationRows = [...observations.values()];

	console.log(`Collected ${observationRows.length} manual-entry nutrient observations.`);
	console.log(
		`Source requests: FDC ${fdcResult.values.length}/${requests.length} succeeded; Open Food Facts ${openFoodFactsResult.values.length}/${options.queries.length} succeeded.`,
	);
	console.table(
		Object.entries(
			observationRows.reduce((counts, observation) => {
				counts[observation.group_title] = (counts[observation.group_title] ?? 0) + 1;
				return counts;
			}, {}),
		).map(([group, count]) => ({ group, count })),
	);

	if (options.dryRun) {
		console.log(`Dry run. Would upsert ${nutrientDefinitionRows.length} definitions and ${observationRows.length} observations.`);
		console.log("Top ignored FDC nutrients:");
		console.table(
			[...ignoredFdcNutrients.entries()]
				.sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
				.slice(0, 20)
				.map(([name, count]) => ({ name, count })),
		);
		console.log("Top ignored Open Food Facts nutriments:");
		console.table(
			[...ignoredOpenFoodFactsNutrients.entries()]
				.sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
				.slice(0, 20)
				.map(([name, count]) => ({ name, count })),
		);
		process.exit(0);
	}

	await upsertInChunks({ supabase, table: "nutrient_definitions", records: nutrientDefinitionRows });
	await upsertInChunks({
		supabase,
		table: "nutrient_manual_entry_observations",
		records: observationRows,
		onConflict: "source,query,source_reference,nutrient_id",
		ignoreDuplicates: true,
	});

	const { error } = await supabase.rpc("sync_nutrient_manual_entry_fields");
	if (error) throw error;

	console.log(`Seeded ${nutrientDefinitionRows.length} nutrient definitions and ${observationRows.length} observations.`);
} catch (error) {
	console.error(error);
	process.exit(1);
}
