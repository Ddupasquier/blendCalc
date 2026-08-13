/**
 * Purpose: Measure how each active imported generic-food dataset contributes records,
 * nutrients, measures, exact identifiers, and bounded search results. Search overlap is
 * descriptive evidence only; similar names are never treated as food identity matches.
 * Run: `node scripts/audits/food-sources/audit_generic_dataset_contribution.mjs --queries=100`
 * Add `--json` for machine-readable output. This audit is read-only.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runSettledWithConcurrency } from "../../lib/reference-data/api.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const requestedQueryCount = Number(
	process.argv.find((argument) => argument.startsWith("--queries="))?.split("=")[1] ?? 100,
);
const queryCount = Number.isFinite(requestedQueryCount)
	? Math.max(20, Math.min(300, Math.floor(requestedQueryCount)))
	: 100;
const jsonOutput = process.argv.includes("--json");

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error("PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
});

const readAllRows = async (table, columns, configure = (query) => query) => {
	const rows = [];
	for (let offset = 0; ; offset += 1000) {
		const query = configure(supabase.from(table).select(columns)).range(offset, offset + 999);
		const { data, error } = await query;
		if (error) throw error;
		rows.push(...(data ?? []));
		if ((data?.length ?? 0) < 1000) return rows;
	}
};

const normalizeDescription = (value) =>
	String(value ?? "")
		.toLocaleLowerCase("en-US")
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");

const getLeadingSearchPhrase = (description) => {
	const tokens = normalizeDescription(description)
		.split(" ")
		.filter((token) => token.length >= 3);
	return tokens.slice(0, 2).join(" ");
};

const createSearchQueryCorpus = (records, datasetKeys) => {
	const candidates = new Map();
	for (const record of records) {
		const query = getLeadingSearchPhrase(record.description);
		if (!query) continue;
		const candidate = candidates.get(query) ?? {
			query,
			recordCount: 0,
			datasetKeys: new Set(),
		};
		candidate.recordCount += 1;
		candidate.datasetKeys.add(record.dataset_key);
		candidates.set(query, candidate);
	}
	const rankedCandidates = [...candidates.values()]
		.sort(
			(left, right) =>
				right.datasetKeys.size - left.datasetKeys.size ||
				right.recordCount - left.recordCount ||
				left.query.localeCompare(right.query),
		);
	const uniqueQueriesPerDataset = Math.floor(
		queryCount / Math.max(1, datasetKeys.length * 2),
	);
	const selectedQueries = datasetKeys.flatMap((datasetKey) =>
		rankedCandidates
			.filter((candidate) =>
				candidate.datasetKeys.size === 1 && candidate.datasetKeys.has(datasetKey)
			)
			.slice(0, uniqueQueriesPerDataset)
			.map((candidate) => candidate.query)
	);
	const sharedQueryCount = Math.max(0, queryCount - selectedQueries.length);
	selectedQueries.push(
		...rankedCandidates
			.filter((candidate) => candidate.datasetKeys.size > 1)
			.slice(0, sharedQueryCount)
			.map((candidate) => candidate.query),
	);
	return selectedQueries;
};

const main = async () => {
	const [datasets, records, identifiers] = await Promise.all([
		readAllRows(
			"generic_food_datasets",
			"key,display_name,source_key,version,food_count,nutrient_value_count,measure_count,active,import_enabled",
			(query) => query.eq("active", true).eq("import_enabled", true).order("key"),
		),
		readAllRows(
			"generic_food_records",
			"dataset_key,source_food_key,description",
			(query) => query.order("dataset_key").order("source_food_key"),
		),
		readAllRows(
			"generic_food_source_identifiers",
			"dataset_key,source_food_key,source_key,identifier_type,identifier_value",
			(query) => query.order("dataset_key").order("source_food_key"),
		),
	]);
	const activeDatasetKeys = new Set(datasets.map((dataset) => dataset.key));
	const activeRecords = records.filter((record) => activeDatasetKeys.has(record.dataset_key));
	const activeIdentifiers = identifiers.filter((identifier) =>
		activeDatasetKeys.has(identifier.dataset_key)
	);
	const normalizedDescriptionDatasets = new Map();
	for (const record of activeRecords) {
		const normalized = normalizeDescription(record.description);
		if (!normalized) continue;
		const datasetKeys = normalizedDescriptionDatasets.get(normalized) ?? new Set();
		datasetKeys.add(record.dataset_key);
		normalizedDescriptionDatasets.set(normalized, datasetKeys);
	}

	const searchQueries = createSearchQueryCorpus(
		activeRecords,
		datasets.map((dataset) => dataset.key),
	);
	const searchRun = await runSettledWithConcurrency(
		searchQueries,
		5,
		async (query) => {
			const { data, error } = await supabase.rpc("search_generic_food_records", {
				p_query: query,
				p_limit: 100,
			});
			if (error) throw error;
			return { query, results: data ?? [] };
		},
	);
	if (searchRun.failures.length > 0) {
		throw new Error(
			`${searchRun.failures.length} generic search contribution queries failed.`,
		);
	}

	const metrics = new Map(datasets.map((dataset) => [dataset.key, {
		datasetKey: dataset.key,
		displayName: dataset.display_name,
		sourceKey: dataset.source_key,
		version: dataset.version,
		foodCount: dataset.food_count,
		nutrientValueCount: dataset.nutrient_value_count,
		measureCount: dataset.measure_count,
		exactIdentifierRecordCount: 0,
		exactIdentifierCount: 0,
		exclusiveNormalizedDescriptionCount: 0,
		queryCoverageCount: 0,
		soleDatasetQueryCount: 0,
		topResultCount: 0,
		returnedResultSlots: 0,
	}]));

	const exactIdentifierRecordKeys = new Map(
		datasets.map((dataset) => [dataset.key, new Set()]),
	);
	for (const identifier of activeIdentifiers) {
		const metric = metrics.get(identifier.dataset_key);
		if (!metric) continue;
		metric.exactIdentifierCount += 1;
		exactIdentifierRecordKeys.get(identifier.dataset_key)?.add(
			`${identifier.dataset_key}\u0000${identifier.source_food_key}`,
		);
	}
	for (const [datasetKey, recordKeys] of exactIdentifierRecordKeys) {
		const metric = metrics.get(datasetKey);
		if (metric) metric.exactIdentifierRecordCount = recordKeys.size;
	}
	for (const record of activeRecords) {
		const normalized = normalizeDescription(record.description);
		if (normalizedDescriptionDatasets.get(normalized)?.size !== 1) continue;
		const metric = metrics.get(record.dataset_key);
		if (metric) metric.exclusiveNormalizedDescriptionCount += 1;
	}
	for (const search of searchRun.values) {
		const resultDatasetKeys = new Set(search.results.map((result) => result.dataset_key));
		for (const datasetKey of resultDatasetKeys) {
			const metric = metrics.get(datasetKey);
			if (!metric) continue;
			metric.queryCoverageCount += 1;
			if (resultDatasetKeys.size === 1) metric.soleDatasetQueryCount += 1;
		}
		const topMetric = metrics.get(search.results[0]?.dataset_key);
		if (topMetric) topMetric.topResultCount += 1;
		for (const result of search.results) {
			const metric = metrics.get(result.dataset_key);
			if (metric) metric.returnedResultSlots += 1;
		}
	}

	const report = {
		generatedAt: new Date().toISOString(),
		method: {
			queryCount: searchQueries.length,
			queryConstruction: "A balanced corpus of leading two-word phrases: half source-exclusive candidates and half phrases represented across datasets.",
			identityBoundary: "Exact source identifiers are identity evidence. Normalized description and search overlap are contribution metrics only.",
		},
		datasets: [...metrics.values()],
	};
	if (jsonOutput) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}
	console.log(`Generic dataset contribution audit (${searchQueries.length} queries)`);
	console.table(report.datasets);
	console.log(report.method.identityBoundary);
};

await main();
