// Discover nutrient types exposed by FoodData Central search results.
//
// Usage:
//   npm run discover:fdc-nutrients
//   npm run discover:fdc-nutrients -- "banana" "whole milk" --pages=1 --page-size=25
//   npm run discover:fdc-nutrients -- --min-occurrences=5 --output=/tmp/fdc-nutrients.json

import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
config({ path: path.join(projectRoot, ".env") });

const API_KEY = process.env.VITE_FDC_API_KEY;
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const DEFAULT_OUTPUT_PATH = path.join(
	projectRoot,
	"scripts/output/fdc-nutrients.json",
);
const DEFAULT_QUERIES = [
	"milk",
	"cheese",
	"yogurt",
	"egg",
	"beef",
	"chicken",
	"fish",
	"shellfish",
	"beans",
	"lentils",
	"nuts",
	"seeds",
	"oil",
	"whole grains",
	"bread",
	"cereal",
	"fruit",
	"berries",
	"vegetables",
	"leafy greens",
	"root vegetables",
	"juice",
	"protein powder",
	"beverages",
	"spices",
	"candy",
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
		minOccurrences: 1,
		concurrency: 3,
		dataTypes: "Foundation,SR Legacy,Branded",
		outputPath: DEFAULT_OUTPUT_PATH,
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
				options.pageSize = parsePositiveInteger(
					value,
					options.pageSize,
					"page-size",
				);
				break;
			case "min-occurrences":
				options.minOccurrences = parsePositiveInteger(
					value,
					options.minOccurrences,
					"min-occurrences",
				);
				break;
			case "concurrency":
				options.concurrency = parsePositiveInteger(
					value,
					options.concurrency,
					"concurrency",
				);
				break;
			case "data-types":
				if (!value) throw new Error("data-types cannot be empty.");
				options.dataTypes = value;
				break;
			case "output":
				if (!value) throw new Error("output cannot be empty.");
				options.outputPath = path.resolve(projectRoot, value);
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
		UG: "µg",
		KCAL: "kcal",
		KJ: "kJ",
		IU: "IU",
	};
	return units[normalized] ?? String(unit ?? "").trim();
};

const incrementCount = (counts, value) => {
	const key = String(value ?? "").trim();
	if (!key) return;
	counts.set(key, (counts.get(key) ?? 0) + 1);
};

const mostFrequentValue = (counts) => {
	return [...counts.entries()].sort(
		([firstValue, firstCount], [secondValue, secondCount]) =>
			secondCount - firstCount || firstValue.localeCompare(secondValue),
	)[0]?.[0];
};

const buildSearchUrl = ({ query, pageNumber, pageSize, dataTypes }) => {
	const url = new URL(`${BASE_URL}/foods/search`);
	url.searchParams.set("api_key", API_KEY);
	url.searchParams.set("query", query);
	url.searchParams.set("pageNumber", String(pageNumber));
	url.searchParams.set("pageSize", String(pageSize));
	url.searchParams.set("dataType", dataTypes);
	return url;
};

const fetchSearchPage = async (request) => {
	const response = await fetch(buildSearchUrl(request));
	if (!response.ok) {
		throw new Error(
			`FDC search failed for "${request.query}" page ${request.pageNumber}: ` +
				`${response.status} ${response.statusText}`,
		);
	}

	const data = await response.json();
	return {
		...request,
		totalHits: Number(data.totalHits) || 0,
		foods: Array.isArray(data.foods) ? data.foods : [],
	};
};

const runWithConcurrency = async (items, concurrency, task) => {
	const results = new Array(items.length);
	let nextIndex = 0;

	const worker = async () => {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await task(items[currentIndex]);
		}
	};

	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, worker),
	);
	return results;
};

const collectNutrients = (pages) => {
	const nutrientsById = new Map();
	const processedFoodIds = new Set();
	const dataTypeCounts = new Map();

	for (const page of pages) {
		for (const food of page.foods) {
			const foodId = Number(food.fdcId);
			if (!Number.isFinite(foodId) || processedFoodIds.has(foodId)) continue;
			processedFoodIds.add(foodId);
			incrementCount(dataTypeCounts, food.dataType);

			const nutrientsSeenForFood = new Set();
			for (const nutrient of food.foodNutrients ?? []) {
				const nutrientId = Number(nutrient.nutrientId);
				if (!Number.isFinite(nutrientId)) continue;

				let record = nutrientsById.get(nutrientId);
				if (!record) {
					record = {
						id: nutrientId,
						names: new Map(),
						units: new Map(),
						nutrientNumbers: new Map(),
						occurrences: 0,
						nonZeroOccurrences: 0,
						dataTypes: new Map(),
					};
					nutrientsById.set(nutrientId, record);
				}

				incrementCount(record.names, nutrient.nutrientName);
				incrementCount(record.units, normalizeUnit(nutrient.unitName));
				incrementCount(record.nutrientNumbers, nutrient.nutrientNumber);
				incrementCount(record.dataTypes, food.dataType);

				if (nutrientsSeenForFood.has(nutrientId)) continue;
				nutrientsSeenForFood.add(nutrientId);
				record.occurrences += 1;
				if (Number(nutrient.value) !== 0) record.nonZeroOccurrences += 1;
			}
		}
	}

	const nutrients = [...nutrientsById.values()]
		.map((record) => ({
			id: record.id,
			label: mostFrequentValue(record.names) ?? `Nutrient ${record.id}`,
			unit: mostFrequentValue(record.units) ?? "",
			nutrientNumber: mostFrequentValue(record.nutrientNumbers) ?? null,
			occurrences: record.occurrences,
			nonZeroOccurrences: record.nonZeroOccurrences,
			availabilityPercent:
				processedFoodIds.size > 0
					? Number(
							((record.occurrences / processedFoodIds.size) * 100).toFixed(1),
						)
					: 0,
			dataTypes: Object.fromEntries(
				[...record.dataTypes.entries()].sort(([first], [second]) =>
					first.localeCompare(second),
				),
			),
		}))
		.sort(
			(first, second) =>
				second.occurrences - first.occurrences ||
				first.label.localeCompare(second.label),
		);

	return {
		nutrients,
		sampledFoodCount: processedFoodIds.size,
		dataTypes: Object.fromEntries(
			[...dataTypeCounts.entries()].sort(([first], [second]) =>
				first.localeCompare(second),
			),
		),
	};
};

const writeCatalog = async ({ report, outputPath }) => {
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(report, null, "\t")}\n`, "utf8");
};

const printSummary = (report, outputPath) => {
	console.log(`Sampled ${report.metadata.sampledFoodCount} unique foods.`);
	console.log(`Discovered ${report.nutrients.length} nutrient types.`);
	console.table(
		report.nutrients.slice(0, 25).map((nutrient) => ({
			id: nutrient.id,
			name: nutrient.label,
			unit: nutrient.unit,
			foods: nutrient.occurrences,
			availability: `${nutrient.availabilityPercent}%`,
		})),
	);
	console.log(`JSON report: ${path.relative(projectRoot, outputPath)}`);
	console.log("Runtime nutrient choices continue to come from Supabase nutrient_definitions.");
};

if (!API_KEY || API_KEY === "your_api_key_here") {
	console.error("Missing API key. Set VITE_FDC_API_KEY in your .env file.");
	process.exit(1);
}

try {
	const options = parseArguments(process.argv.slice(2));
	const requests = options.queries.flatMap((query) =>
		Array.from({ length: options.pages }, (_, index) => ({
			query,
			pageNumber: index + 1,
			pageSize: options.pageSize,
			dataTypes: options.dataTypes,
		})),
	);

	console.log(
		`Requesting ${requests.length} FDC search pages with concurrency ${options.concurrency}...`,
	);
	const pages = await runWithConcurrency(
		requests,
		options.concurrency,
		fetchSearchPage,
	);
	const collection = collectNutrients(pages);
	const generatedAt = new Date().toISOString();
	const report = {
		metadata: {
			generatedAt,
			queries: options.queries,
			pagesPerQuery: options.pages,
			pageSize: options.pageSize,
			dataTypes: options.dataTypes.split(",").map((value) => value.trim()),
			sampledFoodCount: collection.sampledFoodCount,
			sampledDataTypes: collection.dataTypes,
		},
		nutrients: collection.nutrients.filter(
			(nutrient) => nutrient.occurrences >= options.minOccurrences,
		),
	};

	await writeCatalog({
		report,
		outputPath: options.outputPath,
	});
	printSummary(report, options.outputPath);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
