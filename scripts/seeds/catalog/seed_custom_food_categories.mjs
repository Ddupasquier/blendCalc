/**
 * Purpose: Discover category evidence from USDA and Open Food Facts, persist observations,
 * and rebuild canonical category options/mappings in Supabase. Live runs are repeatable;
 * `--rebuild-mappings-only` replaces mappings using already stored observations.
 * Preview: `node scripts/seeds/catalog/seed_custom_food_categories.mjs --dry-run`
 * Execute: `node scripts/seeds/catalog/seed_custom_food_categories.mjs`; add `--deep`
 * for broader discovery or `--rebuild-mappings-only` to reuse stored observations.
 */

import { config } from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	normalizeFoodCategoryValue,
	toFoodCategoryId,
	toFoodCategoryLabel,
} from "../../../src/lib/utils/food/categories/categoryNormalization.js";
import { createAppUserAgent } from "../../lib/releases/app_version.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fdcApiKey =
	process.env.FDC_API_KEY?.trim() || process.env.VITE_FDC_API_KEY?.trim();
const dryRun = process.argv.includes("--dry-run");
const deepSweep = process.argv.includes("--deep");
const rebuildMappingsOnly = process.argv.includes("--rebuild-mappings-only");
const explicitQueries = process.argv
	.slice(2)
	.filter((argument) => !argument.startsWith("--"));

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FDC_URL = "https://api.nal.usda.gov/fdc/v1";
const REQUEST_DELAY_MS = 250;
const APP_USER_AGENT = createAppUserAgent("category observation seed");
const TEMPORARY_ERROR_RETRY_DELAYS_MS = [500, 1500, 3000];
const RATE_LIMIT_RETRY_DELAYS_MS = [5000, 15000, 30000];
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const PAGE_SIZE = 12;
const FDC_BRANDED_DETAIL_SIZE = 8;
const MAX_CATEGORY_LENGTH = 80;
const SUPABASE_PAGE_SIZE = 1000;

const DEFAULT_QUERIES = [
	"whole milk",
	"greek yogurt",
	"almond milk",
	"oat milk",
	"whey protein",
	"protein bar",
	"peanut butter",
	"almond butter",
	"chia seeds",
	"spinach",
	"kale",
	"banana",
	"mango",
	"blueberries",
	"orange juice",
	"smoothie",
	"olive oil",
	"sunflower oil",
	"granola",
	"cereal",
	"bread",
	"gluten free bread",
	"egg",
	"tofu",
	"chicken breast",
	"ground beef",
	"salmon",
	"shrimp",
	"beans",
	"lentil soup",
	"potato chips",
	"tortilla chips",
	"cookies",
	"chocolate",
	"honey",
	"salsa",
	"ranch dressing",
	"coffee",
	"tea",
	"protein shake",
];

const DEEP_SWEEP_QUERIES = [
	...DEFAULT_QUERIES,
	"strawberry jelly",
	"grape jelly",
	"jam",
	"jelly",
	"fruit preserves",
	"marmalade",
	"apple sauce",
	"canned peaches",
	"frozen berries",
	"frozen spinach",
	"baby spinach",
	"romaine lettuce",
	"carrots",
	"celery",
	"cucumber",
	"tomatoes",
	"cherry tomatoes",
	"avocado",
	"sweet potato",
	"butternut squash",
	"pineapple",
	"peaches",
	"apples",
	"pears",
	"grapes",
	"watermelon",
	"coconut water",
	"lemon juice",
	"lime juice",
	"cranberry juice",
	"protein powder",
	"collagen peptides",
	"casein protein",
	"soy protein",
	"plant protein",
	"cottage cheese",
	"cream cheese",
	"cheddar cheese",
	"mozzarella",
	"eggs",
	"egg whites",
	"butter",
	"heavy cream",
	"half and half",
	"coconut milk",
	"soy milk",
	"cashew milk",
	"rice milk",
	"kefir",
	"frozen yogurt",
	"ice cream",
	"oats",
	"rolled oats",
	"instant oatmeal",
	"quinoa",
	"brown rice",
	"white rice",
	"pasta",
	"rice cakes",
	"crackers",
	"pretzels",
	"bagels",
	"english muffins",
	"tortillas",
	"pita bread",
	"muffins",
	"pancakes",
	"waffles",
	"maple syrup",
	"agave syrup",
	"molasses",
	"sugar",
	"brown sugar",
	"stevia",
	"splenda",
	"cocoa powder",
	"dark chocolate",
	"milk chocolate",
	"chocolate chips",
	"almonds",
	"walnuts",
	"pecans",
	"cashews",
	"pistachios",
	"sunflower seeds",
	"pumpkin seeds",
	"flax seeds",
	"sesame seeds",
	"hemp seeds",
	"trail mix",
	"dried cranberries",
	"raisins",
	"dates",
	"figs",
	"beef jerky",
	"turkey slices",
	"ham",
	"bacon",
	"sausage",
	"hot dogs",
	"chicken nuggets",
	"plant based nuggets",
	"tofu scramble",
	"tempeh",
	"edamame",
	"hummus",
	"black beans",
	"kidney beans",
	"chickpeas",
	"refried beans",
	"lentils",
	"split peas",
	"chili",
	"tomato soup",
	"chicken broth",
	"beef broth",
	"vegetable broth",
	"bone broth",
	"curry sauce",
	"tomato sauce",
	"pesto",
	"soy sauce",
	"teriyaki sauce",
	"hot sauce",
	"mustard",
	"ketchup",
	"mayonnaise",
	"bbq sauce",
	"salad dressing",
	"caesar dressing",
	"vinaigrette",
	"pickles",
	"olives",
	"sauerkraut",
	"kimchi",
	"frozen pizza",
	"macaroni and cheese",
	"frozen burrito",
	"energy drink",
	"sports drink",
	"sparkling water",
	"kombucha",
	"green tea",
	"black tea",
	"espresso",
	"canned tuna",
	"canned salmon",
	"sardines",
	"cod",
	"tilapia",
	"turkey breast",
	"pork tenderloin",
	"steak",
	"lamb",
	"meatballs",
	"veggie burger",
	"black bean burger",
	"nut free granola",
];

const queries = [
	...new Set(
		explicitQueries.length > 0
			? explicitQueries
			: deepSweep
				? DEEP_SWEEP_QUERIES
				: DEFAULT_QUERIES,
	),
];

const sleep = (milliseconds) =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});

const parseRetryAfterHeader = (value) => {
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return seconds * 1000;
	}

	const retryAt = Date.parse(value);
	if (Number.isFinite(retryAt)) {
		return Math.max(retryAt - Date.now(), 0);
	}

	return null;
};

const getRetryDelays = (status) =>
	status === 429 ? RATE_LIMIT_RETRY_DELAYS_MS : TEMPORARY_ERROR_RETRY_DELAYS_MS;

const cleanSourceCategory = (value) => {
	const normalized = normalizeFoodCategoryValue(value);
	if (!normalized) return null;
	if (normalized.length > MAX_CATEGORY_LENGTH) return null;
	if (/^\d+$/.test(normalized)) return null;
	if (["foods", "food", "products", "product"].includes(normalized))
		return null;
	return {
		category_id: toFoodCategoryId(normalized),
		label: toFoodCategoryLabel(normalized),
		normalized_value: normalized,
		source_value: String(value ?? "").trim(),
	};
};

const splitDelimitedValues = (value) =>
	String(value ?? "")
		.split(/[;,>]/)
		.map((part) => part.trim())
		.filter(Boolean);

const categoryKey = (category) =>
	[
		category.source,
		category.query,
		category.source_field,
		category.normalized_value,
		category.source_reference ?? "",
	].join("\u001f");

const observations = new Map();

const addCategoryObservation = (category) => {
	const cleaned = cleanSourceCategory(category.source_value);
	if (!cleaned) return;

	const row = {
		...category,
		...cleaned,
	};
	const key = categoryKey(row);
	const existing = observations.get(key);
	if (existing) {
		existing.observation_count += 1;
		return;
	}

	observations.set(key, {
		...row,
		observation_count: 1,
	});
};

const fetchJson = async (url, options = {}, label = "API request") => {
	for (
		let attempt = 0;
		attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length;
		attempt += 1
	) {
		let response;
		try {
			response = await fetch(url, options);
		} catch (error) {
			if (attempt === TEMPORARY_ERROR_RETRY_DELAYS_MS.length) {
				throw error;
			}

			const delay = TEMPORARY_ERROR_RETRY_DELAYS_MS[attempt];
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`${label} failed: ${message}; retrying in ${delay}ms`);
			await sleep(delay);
			continue;
		}

		if (response.ok) {
			return await response.json();
		}

		const message = `${label} failed: ${response.status} ${response.statusText}`;
		const retryDelays = getRetryDelays(response.status);
		if (
			!RETRYABLE_STATUS_CODES.has(response.status) ||
			attempt === retryDelays.length
		) {
			throw new Error(message);
		}

		const retryAfterDelay = parseRetryAfterHeader(
			response.headers.get("retry-after"),
		);
		const delay = retryAfterDelay ?? retryDelays[attempt];
		console.warn(`${message}; retrying in ${delay}ms`);
		await sleep(delay);
	}

	throw new Error(`${label} failed after retries`);
};

const createSupabaseClient = () => {
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(
			"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
		);
	}

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

const fetchAllRows = async (buildQuery) => {
	const rows = [];
	for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
		const { data, error } = await buildQuery().range(
			from,
			from + SUPABASE_PAGE_SIZE - 1,
		);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < SUPABASE_PAGE_SIZE) break;
	}
	return rows;
};

const buildFdcSearchUrl = ({ query, dataType, pageSize = PAGE_SIZE }) => {
	const url = new URL(`${FDC_URL}/foods/search`);
	url.searchParams.set("api_key", fdcApiKey);
	url.searchParams.set("query", query);
	url.searchParams.set("pageSize", String(pageSize));
	url.searchParams.set("dataType", dataType);
	return url;
};

const buildFdcDetailUrl = (fdcId) => {
	const url = new URL(`${FDC_URL}/food/${fdcId}`);
	url.searchParams.set("api_key", fdcApiKey);
	return url;
};

const collectOpenFoodFactsCategories = async (query) => {
	const fields = [
		"code",
		"product_name",
		"brands",
		"categories",
		"categories_tags",
		"categories_hierarchy",
		"main_category",
		"food_groups",
		"food_groups_tags",
	].join(",");
	const url = new URL(OPEN_FOOD_FACTS_URL);
	url.searchParams.set("search_terms", query);
	url.searchParams.set("search_simple", "1");
	url.searchParams.set("action", "process");
	url.searchParams.set("json", "1");
	url.searchParams.set("page_size", String(PAGE_SIZE));
	url.searchParams.set("fields", fields);

	const data = await fetchJson(
		url,
		{
			headers: {
				accept: "application/json",
				"user-agent": APP_USER_AGENT,
			},
		},
		`Open Food Facts category search for "${query}"`,
	);

	for (const product of data.products ?? []) {
		const sourceReference = product.code ? String(product.code) : null;
		const sourcePayload = {
			product_name: product.product_name ?? null,
			brands: product.brands ?? null,
			categories: product.categories ?? null,
			categories_tags: product.categories_tags ?? [],
			categories_hierarchy: product.categories_hierarchy ?? [],
			main_category: product.main_category ?? null,
			food_groups: product.food_groups ?? null,
			food_groups_tags: product.food_groups_tags ?? [],
		};

		for (const value of splitDelimitedValues(product.categories)) {
			addCategoryObservation({
				source: "open-food-facts",
				query,
				source_field: "categories",
				source_value: value,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}

		for (const value of product.categories_tags ?? []) {
			addCategoryObservation({
				source: "open-food-facts",
				query,
				source_field: "categories_tags",
				source_value: value,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}

		for (const value of product.categories_hierarchy ?? []) {
			addCategoryObservation({
				source: "open-food-facts",
				query,
				source_field: "categories_hierarchy",
				source_value: value,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}

		if (product.main_category) {
			addCategoryObservation({
				source: "open-food-facts",
				query,
				source_field: "main_category",
				source_value: product.main_category,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}

		if (product.food_groups) {
			addCategoryObservation({
				source: "open-food-facts",
				query,
				source_field: "food_groups",
				source_value: product.food_groups,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}

		for (const value of product.food_groups_tags ?? []) {
			addCategoryObservation({
				source: "open-food-facts",
				query,
				source_field: "food_groups_tags",
				source_value: value,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}
	}
};

const listUnique = (values) => [...new Set(values.filter(Boolean))].sort();

const groupObservationsForMappings = (observationRows, options) => {
	const optionByNormalizedValue = new Map(
		options.map((option) => [option.normalized_value, option]),
	);
	const grouped = new Map();

	for (const observation of observationRows) {
		const option = optionByNormalizedValue.get(observation.normalized_value);
		if (!option) continue;
		const existing = grouped.get(observation.normalized_value) ?? {
			source_normalized_value: observation.normalized_value,
			source_value: observation.source_value,
			source_values: [],
			source_fields: [],
			sources: [],
			category_option_id: option.id,
			category_option_label: option.label,
			confidence: "exact",
			match_reason: "exact_api_observation",
			source_count: 0,
			observation_count: 0,
			first_seen_at: observation.first_seen_at,
			last_seen_at: observation.last_seen_at,
		};

		existing.source_values.push(observation.source_value);
		existing.source_fields.push(observation.source_field);
		existing.sources.push(observation.source);
		existing.observation_count += observation.observation_count ?? 1;
		if (observation.first_seen_at < existing.first_seen_at) {
			existing.first_seen_at = observation.first_seen_at;
		}
		if (observation.last_seen_at > existing.last_seen_at) {
			existing.last_seen_at = observation.last_seen_at;
		}
		grouped.set(observation.normalized_value, existing);
	}

	return [...grouped.values()].map((mapping) => {
		const sources = listUnique(mapping.sources);
		return {
			...mapping,
			source_values: listUnique(mapping.source_values),
			source_fields: listUnique(mapping.source_fields),
			sources,
			source_count: sources.length,
		};
	});
};

const collectFdcCategories = async (query) => {
	if (!fdcApiKey || fdcApiKey === "your_api_key_here") return;

	const data = await fetchJson(
		buildFdcSearchUrl({
			query,
			dataType: "Foundation,SR Legacy",
		}),
		{},
		`FDC category search for "${query}"`,
	);

	for (const food of data.foods ?? []) {
		const sourcePayload = {
			fdcId: food.fdcId ?? null,
			dataType: food.dataType ?? null,
			description: food.description ?? null,
			brandOwner: food.brandOwner ?? null,
			foodCategory: food.foodCategory ?? null,
		};

		if (food.foodCategory) {
			addCategoryObservation({
				source: "fdc-search",
				query,
				source_field: "foodCategory",
				source_value: food.foodCategory,
				source_reference: food.fdcId ? String(food.fdcId) : null,
				source_payload: sourcePayload,
			});
		}
	}
};

const getFoodCategoryValues = (foodCategory) => {
	if (!foodCategory) return [];
	if (typeof foodCategory === "string") return [foodCategory];
	return [
		foodCategory.description,
		foodCategory.code,
		foodCategory.type,
	].filter(Boolean);
};

const collectFdcBrandedDetailCategories = async (query) => {
	if (!fdcApiKey || fdcApiKey === "your_api_key_here") return;

	const data = await fetchJson(
		buildFdcSearchUrl({
			query,
			dataType: "Branded",
			pageSize: FDC_BRANDED_DETAIL_SIZE,
		}),
		{},
		`FDC branded category search for "${query}"`,
	);

	for (const food of data.foods ?? []) {
		if (!food.fdcId) continue;
		await sleep(REQUEST_DELAY_MS);

		const detail = await fetchJson(
			buildFdcDetailUrl(food.fdcId),
			{},
			`FDC branded category detail for "${query}"`,
		);
		const sourceReference = String(food.fdcId);
		const sourcePayload = {
			fdcId: food.fdcId,
			dataType: detail.dataType ?? food.dataType ?? null,
			description: detail.description ?? food.description ?? null,
			brandOwner: detail.brandOwner ?? food.brandOwner ?? null,
			brandedFoodCategory: detail.brandedFoodCategory ?? null,
			foodCategory: detail.foodCategory ?? food.foodCategory ?? null,
		};

		if (detail.brandedFoodCategory) {
			addCategoryObservation({
				source: "fdc-branded-detail",
				query,
				source_field: "brandedFoodCategory",
				source_value: detail.brandedFoodCategory,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}

		for (const value of getFoodCategoryValues(
			detail.foodCategory ?? food.foodCategory,
		)) {
			addCategoryObservation({
				source: "fdc-branded-detail",
				query,
				source_field: "foodCategory",
				source_value: value,
				source_reference: sourceReference,
				source_payload: sourcePayload,
			});
		}
	}
};

const upsertCategoryObservations = async () => {
	const supabase = createSupabaseClient();
	const timestamp = new Date().toISOString();
	const rows = [...observations.values()].map((observation) => ({
		...observation,
		first_seen_at: timestamp,
		last_seen_at: timestamp,
	}));

	for (let index = 0; index < rows.length; index += 500) {
		const chunk = rows.slice(index, index + 500);
		const { error } = await supabase
			.from("custom_food_category_observations")
			.upsert(chunk, {
				onConflict:
					"source,query,source_field,normalized_value,source_reference",
			});
		if (error) throw error;
	}

	const { error } = await supabase.rpc("rebuild_custom_food_category_options");
	if (error) throw error;

	const mappingCount = await rebuildCategoryMappings(supabase);

	return {
		observations: rows.length,
		mappings: mappingCount,
	};
};

const rebuildCategoryMappings = async (supabase = createSupabaseClient()) => {
	const { error } = await supabase.rpc("rebuild_custom_food_category_options");
	if (error) throw error;

	const [optionRows, observationRows] = await Promise.all([
		fetchAllRows(() =>
			supabase
				.from("custom_food_category_options")
				.select("id, label, normalized_value")
				.eq("enabled", true)
				.order("normalized_value", { ascending: true }),
		),
		fetchAllRows(() =>
			supabase
				.from("custom_food_category_observations")
				.select(
					"source, source_field, source_value, normalized_value, observation_count, first_seen_at, last_seen_at",
				)
				.order("normalized_value", { ascending: true }),
		),
	]);

	const mappingRows = groupObservationsForMappings(observationRows, optionRows);

	const { error: deleteMappingsError } = await supabase
		.from("custom_food_category_mappings")
		.delete()
		.neq("source_normalized_value", "");
	if (deleteMappingsError) throw deleteMappingsError;

	for (let index = 0; index < mappingRows.length; index += 500) {
		const chunk = mappingRows.slice(index, index + 500);
		const { error: mappingError } = await supabase
			.from("custom_food_category_mappings")
			.upsert(chunk, {
				onConflict: "source_normalized_value",
			});
		if (mappingError) throw mappingError;
	}

	return mappingRows.length;
};

if (rebuildMappingsOnly) {
	const mappingCount = await rebuildCategoryMappings();
	console.log(
		`Rebuilt ${mappingCount} category mappings from stored API observations.`,
	);
} else {
	for (const [index, query] of queries.entries()) {
		console.log(`[${index + 1}/${queries.length}] ${query}`);
		try {
			await collectOpenFoodFactsCategories(query);
		} catch (error) {
			console.warn(error instanceof Error ? error.message : error);
		}
		await sleep(REQUEST_DELAY_MS);
		try {
			await collectFdcCategories(query);
		} catch (error) {
			console.warn(error instanceof Error ? error.message : error);
		}
		await sleep(REQUEST_DELAY_MS);
		try {
			await collectFdcBrandedDetailCategories(query);
		} catch (error) {
			console.warn(error instanceof Error ? error.message : error);
		}
		await sleep(REQUEST_DELAY_MS);
	}

	const categories = [...observations.values()].reduce(
		(summary, observation) => {
			const existing = summary.get(observation.category_id);
			if (existing) {
				existing.observations += observation.observation_count;
				existing.sources.add(observation.source);
				return summary;
			}
			summary.set(observation.category_id, {
				label: observation.label,
				observations: observation.observation_count,
				sources: new Set([observation.source]),
			});
			return summary;
		},
		new Map(),
	);

	console.log(
		`Collected ${observations.size} category observations for ${categories.size} category options.`,
	);
	console.table(
		[...categories.values()]
			.sort((first, second) => second.observations - first.observations)
			.slice(0, 20)
			.map((category) => ({
				label: category.label,
				observations: category.observations,
				sources: category.sources.size,
			})),
	);

	if (dryRun) {
		console.log("Dry run complete. No database rows were written.");
	} else {
		const seedResult = await upsertCategoryObservations();
		console.log(
			`Seeded ${seedResult.observations} category observations, rebuilt options, and wrote ${seedResult.mappings} category mappings.`,
		);
	}
}
