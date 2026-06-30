import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fetch from "node-fetch";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ws from "ws";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
config({ path: path.join(projectRoot, ".env.moderation.local"), quiet: true });
config({ path: path.join(projectRoot, ".env"), quiet: true });

const FDC_API_KEY = process.env.VITE_FDC_API_KEY;
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const OPEN_FOOD_FACTS_PAGE_SIZE = 20;
const DISCOVERED_FDC_NUTRIENTS_PATH = path.join(
	projectRoot,
	"scripts/output/fdc-nutrients.json",
);

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

const normalizeName = (value) =>
	String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const normalizeLookupKey = (value) =>
	normalizeName(value)
		.replace(/\btotal\b/g, "")
		.replace(/\bincluding nlea\b/g, "")
		.replace(/\bdifference\b/g, "")
		.replace(/\bby\b/g, "")
		.replace(/\bsubtract\b/g, "")
		.replace(/\bkilocalories?\b/g, "kcal")
		.replace(/\bkilojoules?\b/g, "kj")
		.replace(/\s+/g, " ")
		.trim();

const singularizeLookupKey = (value) =>
	value
		.split(" ")
		.map((part) => {
			if (part.length > 3 && part.endsWith("ies")) return `${part.slice(0, -3)}y`;
			if (part.length > 3 && part.endsWith("s")) return part.slice(0, -1);
			return part;
		})
		.join(" ");

const OFF_NUTRIMENT_LOOKUP_KEYS = {
	"energy kcal": ["energy", "calories", "calorie"],
	"energy kj": ["energy kj", "energy kilojoule"],
	fat: ["total lipid fat", "total fat", "fat"],
	"saturated fat": ["fatty acids saturated", "saturated fat"],
	"trans fat": ["fatty acids trans", "trans fat"],
	"monounsaturated fat": ["fatty acids monounsaturated", "monounsaturated fat"],
	"polyunsaturated fat": ["fatty acids polyunsaturated", "polyunsaturated fat"],
	carbohydrates: ["carbohydrate by difference", "total carbohydrate", "carbohydrate"],
	sugars: ["sugars total", "total sugars", "sugar"],
	salt: ["sodium na", "sodium"],
	"added sugars": ["sugars added", "added sugars"],
	fiber: ["fiber total dietary", "dietary fiber", "fiber"],
	starch: ["starch"],
	proteins: ["protein"],
	protein: ["protein"],
	sodium: ["sodium"],
	calcium: ["calcium ca", "calcium"],
	iron: ["iron fe", "iron"],
	potassium: ["potassium k", "potassium"],
	magnesium: ["magnesium mg", "magnesium"],
	phosphorus: ["phosphorus p", "phosphorus"],
	zinc: ["zinc zn", "zinc"],
	copper: ["copper cu", "copper"],
	manganese: ["manganese mn", "manganese"],
	selenium: ["selenium se", "selenium"],
	"vitamin a": ["vitamin a"],
	"vitamin c": ["vitamin c"],
	"vitamin d": ["vitamin d"],
	"vitamin e": ["vitamin e"],
	"vitamin k": ["vitamin k"],
	"vitamin b1": ["thiamin", "thiamine"],
	"vitamin b2": ["riboflavin"],
	"vitamin b9": ["folate", "folic acid"],
	thiamin: ["thiamin", "thiamine"],
	riboflavin: ["riboflavin"],
	niacin: ["niacin"],
	folate: ["folate", "folic acid"],
	"vitamin b6": ["vitamin b 6", "vitamin b6"],
	"vitamin b12": ["vitamin b 12", "vitamin b12"],
	biotin: ["biotin"],
	choline: ["choline"],
	iodine: ["iodine"],
	chloride: ["chloride"],
};

const normalizeOpenFoodFactsNutrimentKey = (key) =>
	normalizeLookupKey(
		String(key ?? "")
			.replace(/_(100g|serving|unit|value)$/i, "")
			.replace(/-/g, " "),
	);

const getOpenFoodFactsLookupKeys = (key) => {
	const normalized = normalizeOpenFoodFactsNutrimentKey(key);
	const aliases = OFF_NUTRIMENT_LOOKUP_KEYS[normalized] ?? [];
	return [...new Set([normalized, singularizeLookupKey(normalized), ...aliases].map(normalizeLookupKey))];
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

const buildManualEntryDedupeKey = ({ entryStep, groupId, displayLabel, unitName }) =>
	[
		entryStep,
		groupId,
		normalizeLookupKey(displayLabel),
		normalizeUnit(unitName).toLowerCase(),
	]
		.filter(Boolean)
		.join(":");

const withManualEntryDedupeKey = (observation) => ({
	...observation,
	dedupe_key: buildManualEntryDedupeKey({
		entryStep: observation.entry_step,
		groupId: observation.group_id,
		displayLabel: observation.display_label,
		unitName: observation.unit_name,
	}),
});

const matchAny = (name, patterns) => patterns.some((pattern) => pattern.test(name));

const classifyNutrient = ({ nutrientName, unitName }) => {
	const name = normalizeName(nutrientName);
	const unit = normalizeUnit(unitName).toLowerCase();

	if (matchAny(name, [/\benergy\b/, /\bcalories?\b/]) && unit === "kcal") {
		return {
			groupId: "required-basics",
			nutrientType: "energy",
			fieldSortOrder: 10,
			displayLabel: "Calories (kcal)",
			classificationMethod: "fdc-name-unit",
		};
	}

	if (matchAny(name, [/\bprotein\b/])) {
		return {
			groupId: "required-basics",
			nutrientType: "macro",
			fieldSortOrder: 40,
			displayLabel: formatDisplayLabel("Protein", unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\btotal lipid\b/, /\btotal fat\b/])) {
		return {
			groupId: "required-basics",
			nutrientType: "macro",
			fieldSortOrder: 20,
			displayLabel: formatDisplayLabel("Total Fat", unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\bcarbohydrate\b.*\bdifference\b/, /\btotal carbohydrate\b/])) {
		return {
			groupId: "required-basics",
			nutrientType: "macro",
			fieldSortOrder: 30,
			displayLabel: formatDisplayLabel("Total Carbohydrates", unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\bsodium\b/])) {
		return {
			groupId: "required-basics",
			nutrientType: "mineral",
			fieldSortOrder: 50,
			displayLabel: formatDisplayLabel("Sodium", unitName),
			classificationMethod: "fdc-name-required-basic",
		};
	}

	if (matchAny(name, [/\bfiber\b/, /\bsugars?\b/, /\bstarch\b/])) {
		const order = matchAny(name, [/\bfiber\b/])
			? 10
			: matchAny(name, [/\badded sugars?\b/])
				? 30
				: 20;
		return {
			groupId: "carbohydrate-details",
			nutrientType: "carbohydrate",
			fieldSortOrder: order,
			displayLabel: formatDisplayLabel(nutrientName, unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\bfatty acids?\b/, /\bsaturated\b/, /\btrans\b/, /\bmonounsaturated\b/, /\bpolyunsaturated\b/, /\bcholesterol\b/, /\bsfa\b/, /\bmufa\b/, /\bpufa\b/])) {
		const order = matchAny(name, [/\bsaturated\b/])
			? 10
			: matchAny(name, [/\btrans\b/])
				? 20
				: matchAny(name, [/\bpolyunsaturated\b/])
					? 30
					: matchAny(name, [/\bmonounsaturated\b/])
						? 40
						: 50;
		return {
			groupId: "fat-details",
			nutrientType: "fat",
			fieldSortOrder: order,
			displayLabel: formatDisplayLabel(nutrientName, unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\bvitamin\b/, /\bthiamin\b/, /\briboflavin\b/, /\bniacin\b/, /\bfolate\b/, /\bfolic acid\b/, /\bbiotin\b/, /\bpantothenic\b/, /\bcholine\b/, /\bretinol\b/, /\bcarotene\b/, /\bcryptoxanthin\b/, /\blycopene\b/, /\blutein\b/, /\bzeaxanthin\b/])) {
		return {
			groupId: "vitamins",
			nutrientType: "vitamin",
			fieldSortOrder: 1000 + name.localeCompare(""),
			displayLabel: formatDisplayLabel(nutrientName, unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\bcalcium\b/, /\biron\b/, /\bpotassium\b/, /\bphosphorus\b/, /\bmagnesium\b/, /\bzinc\b/, /\bselenium\b/, /\bcopper\b/, /\bmanganese\b/, /\biodine\b/, /\bfluoride\b/, /\bchromium\b/, /\bmolybdenum\b/, /\bchloride\b/, /\bash\b/])) {
		const groupId = matchAny(name, [/\bash\b/])
			? "mineral-details"
			: "minerals";
		return {
			groupId,
			nutrientType: "mineral",
			fieldSortOrder: groupId === "mineral-details" ? 10 : 1000 + name.localeCompare(""),
			displayLabel: formatDisplayLabel(nutrientName, unitName),
			classificationMethod: "fdc-name",
		};
	}

	if (matchAny(name, [/\bleucine\b/, /\bisoleucine\b/, /\bvaline\b/, /\blysine\b/, /\bmethionine\b/, /\bthreonine\b/, /\btryptophan\b/, /\bphenylalanine\b/, /\bhistidine\b/, /\barginine\b/, /\bcystine\b/, /\btyrosine\b/, /\balanine\b/, /\baspartic\b/, /\bglutamic\b/, /\bglycine\b/, /\bproline\b/, /\bserine\b/])) {
		return {
			groupId: "amino-acids",
			nutrientType: "amino_acid",
			fieldSortOrder: 1000 + name.localeCompare(""),
			displayLabel: formatDisplayLabel(nutrientName, unitName),
			classificationMethod: "fdc-name",
		};
	}

	return {
		groupId: "other-nutrients",
		nutrientType: "other",
		fieldSortOrder: 5000,
		displayLabel: formatDisplayLabel(nutrientName, unitName),
		classificationMethod: "fdc-name-fallback",
	};
};

const toGroupTitle = (groupId) => {
	if (groupId === "amino-acids") return "Amino Acids";
	return titleCase(groupId.replace(/-/g, " "));
};

const getGroupSortOrder = (groupId, nutrientType) => {
	if (groupId === "required-basics") return 10;
	if (groupId === "carbohydrate-details") return 20;
	if (groupId === "fat-details") return 30;
	if (groupId === "mineral-details") return 40;
	if (nutrientType === "vitamin") return 10;
	if (nutrientType === "mineral") return 20;
	if (nutrientType === "amino_acid") return 30;
	return 90;
};

const getManualEntryGroup = (classification) => {
	const entryStep = ["vitamin", "amino_acid"].includes(classification.nutrientType)
		|| (classification.nutrientType === "mineral" && classification.groupId !== "mineral-details")
		|| classification.groupId === "other-nutrients"
		? "extended"
		: "macros";

	return {
		entryStep,
		title: toGroupTitle(classification.groupId),
		groupSortOrder: getGroupSortOrder(
			classification.groupId,
			classification.nutrientType,
		),
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
	const response = await fetch(buildSearchUrl(request));
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

	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": "SmoothieMixer/1.0 (manual nutrient observation seed)",
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

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
	return results;
};

const buildCanonicalNutrientLookup = (nutrientDefinitions) => {
	const lookup = new Map();
	for (const definition of nutrientDefinitions.values()) {
		const keys = [
			definition.nutrient_name,
			`${definition.nutrient_name} ${definition.default_unit_name}`,
			definition.nutrient_name?.split(",")[0],
			`${definition.nutrient_name?.split(",")[0]} ${definition.default_unit_name}`,
			definition.nutrient_name?.replace(/\(.+?\)/g, ""),
			definition.nutrient_name?.replace(/,\s*(ca|fe|k|mg|p|na|zn|cu|mn|se)$/i, ""),
			definition.nutrient_number,
		]
			.filter(Boolean)
			.flatMap((value) => {
				const normalized = normalizeLookupKey(value);
				return [normalized, singularizeLookupKey(normalized)];
			});

		for (const key of keys) {
			if (key && !lookup.has(key)) lookup.set(key, definition);
		}
	}
	return lookup;
};

const readDiscoveredFdcNutrients = () => {
	try {
		const report = JSON.parse(readFileSync(DISCOVERED_FDC_NUTRIENTS_PATH, "utf8"));
		return Array.isArray(report.nutrients) ? report.nutrients : [];
	} catch (error) {
		console.warn(
			`Could not read ${path.relative(projectRoot, DISCOVERED_FDC_NUTRIENTS_PATH)}. Continuing with live FDC observations only.`,
		);
		return [];
	}
};

const buildDiscoveredFdcNutrientDefinitions = () => {
	const definitions = new Map();

	for (const nutrient of readDiscoveredFdcNutrients()) {
		const nutrientId = Number(nutrient.id);
		const nutrientName = String(nutrient.label ?? "").trim();
		const unitName = normalizeUnit(nutrient.unit);
		if (!Number.isFinite(nutrientId) || !nutrientName || !unitName) continue;

		definitions.set(nutrientId, {
			nutrient_id: nutrientId,
			nutrient_name: nutrientName,
			nutrient_number: String(nutrient.nutrientNumber ?? "").trim() || null,
			default_unit_name: unitName,
		});
	}

	return definitions;
};

const collectFdcObservations = (pages) => {
	const nutrientDefinitions = buildDiscoveredFdcNutrientDefinitions();
	const observations = new Map();
	const ignoredNutrients = new Map();

	for (const page of pages) {
		for (const food of page.foods) {
			const foodId = Number(food.fdcId);
			if (!Number.isFinite(foodId)) continue;

			for (const nutrient of food.foodNutrients ?? []) {
				const nutrientId = Number(nutrient.nutrientId);
				const nutrientName = String(nutrient.nutrientName ?? "").trim();
				const unitName = normalizeUnit(nutrient.unitName);
				if (!Number.isFinite(nutrientId) || !nutrientName || !unitName) continue;

				const classification = classifyNutrient({ nutrientName, unitName });
				if (!classification) {
					ignoredNutrients.set(nutrientName, (ignoredNutrients.get(nutrientName) ?? 0) + 1);
					continue;
				}

				const group = getManualEntryGroup(classification);

				nutrientDefinitions.set(nutrientId, {
					nutrient_id: nutrientId,
					nutrient_name: nutrientName,
					nutrient_number: String(nutrient.nutrientNumber ?? "").trim() || null,
					default_unit_name: unitName,
				});

				const sourceReference = `${foodId}:${nutrientId}`;
				observations.set(`${page.source}:${page.query}:${sourceReference}`, withManualEntryDedupeKey({
					source: page.source,
					query: page.query,
					source_reference: sourceReference,
					source_food_name: String(food.description ?? "").trim() || null,
					source_data_type: String(food.dataType ?? "").trim() || null,
					nutrient_id: nutrientId,
					nutrient_name: nutrientName,
					nutrient_number: String(nutrient.nutrientNumber ?? "").trim() || null,
					unit_name: unitName,
					entry_step: group.entryStep,
					group_id: classification.groupId,
					group_title: group.title,
					group_sort_order: group.groupSortOrder,
					nutrient_type: classification.nutrientType,
					display_label: classification.displayLabel,
					field_sort_order: classification.fieldSortOrder,
					classification_method: classification.classificationMethod,
					source_payload: {
						fdcId: foodId,
						dataType: food.dataType,
						nutrientValue: nutrient.value ?? null,
					},
				}));
			}
		}
	}

	return {
		nutrientDefinitions,
		observations,
		ignoredNutrients,
	};
};

const collectOpenFoodFactsObservations = ({ pages, nutrientDefinitions, observations }) => {
	const canonicalLookup = buildCanonicalNutrientLookup(nutrientDefinitions);
	const ignoredNutrients = new Map();

	for (const page of pages) {
		for (const product of page.products) {
			const code = String(product.code ?? "").trim();
			if (!code || !product.nutriments) continue;

			for (const [rawKey, rawValue] of Object.entries(product.nutriments)) {
				if (!rawKey.endsWith("_100g")) continue;
				if (!Number.isFinite(Number(rawValue))) continue;

				const lookupKeys = getOpenFoodFactsLookupKeys(rawKey);
				const definition = lookupKeys
					.map((key) => canonicalLookup.get(key))
					.find(Boolean);

				if (!definition) {
					ignoredNutrients.set(rawKey, (ignoredNutrients.get(rawKey) ?? 0) + 1);
					continue;
				}

				const classification = classifyNutrient({
					nutrientName: definition.nutrient_name,
					unitName: definition.default_unit_name,
				});
				if (!classification) continue;

				const group = getManualEntryGroup(classification);

				const sourceReference = `${code}:${rawKey}`;
				observations.set(`open-food-facts:${page.query}:${sourceReference}`, withManualEntryDedupeKey({
					source: "open-food-facts",
					query: page.query,
					source_reference: sourceReference,
					source_food_name: String(product.product_name ?? "").trim() || null,
					source_data_type: "Open Food Facts",
					nutrient_id: definition.nutrient_id,
					nutrient_name: definition.nutrient_name,
					nutrient_number: definition.nutrient_number,
					unit_name: definition.default_unit_name,
					entry_step: group.entryStep,
					group_id: classification.groupId,
					group_title: group.title,
					group_sort_order: group.groupSortOrder,
					nutrient_type: classification.nutrientType,
					display_label: classification.displayLabel,
					field_sort_order: classification.fieldSortOrder,
					classification_method: `${classification.classificationMethod}+off-key-match`,
					source_payload: {
						code,
						productName: product.product_name ?? null,
						brands: product.brands ?? null,
						categories: product.categories ?? null,
						nutrimentKey: rawKey,
						nutrimentValue: Number(rawValue),
					},
				}));
			}
		}
	}

	return ignoredNutrients;
};

const upsertInChunks = async ({ supabase, table, records, chunkSize = 500 }) => {
	for (let start = 0; start < records.length; start += chunkSize) {
		const chunk = records.slice(start, start + chunkSize);
		const { error } = await supabase.from(table).upsert(chunk);
		if (error) throw error;
	}
};

if (!FDC_API_KEY || FDC_API_KEY === "your_api_key_here") {
	console.error("Missing VITE_FDC_API_KEY in .env.");
	process.exit(1);
}

try {
	const options = parseArguments(process.argv.slice(2));
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
	const pages = await runWithConcurrency(requests, options.concurrency, fetchSearchPage);
	const {
		nutrientDefinitions,
		observations,
		ignoredNutrients: ignoredFdcNutrients,
	} = collectFdcObservations(pages);
	const openFoodFactsPages = await runWithConcurrency(
		options.queries,
		Math.min(options.concurrency, 2),
		fetchOpenFoodFactsPage,
	);
	const ignoredOpenFoodFactsNutrients = collectOpenFoodFactsObservations({
		pages: openFoodFactsPages,
		nutrientDefinitions,
		observations,
	});
	const nutrientDefinitionRows = [...nutrientDefinitions.values()];
	const observationRows = [...observations.values()];

	console.log(`Collected ${observationRows.length} manual-entry nutrient observations.`);
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

	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		throw new Error("Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
	}

	const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		realtime: { transport: ws },
		auth: { persistSession: false, autoRefreshToken: false },
	});

	await upsertInChunks({ supabase, table: "nutrient_definitions", records: nutrientDefinitionRows });
	await upsertInChunks({ supabase, table: "nutrient_manual_entry_observations", records: observationRows });

	const { error } = await supabase.rpc("sync_nutrient_manual_entry_fields");
	if (error) throw error;

	console.log(`Seeded ${nutrientDefinitionRows.length} nutrient definitions and ${observationRows.length} observations.`);
} catch (error) {
	console.error(error);
	process.exit(1);
}
