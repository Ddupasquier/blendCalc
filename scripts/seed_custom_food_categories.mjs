// Seed custom food category options from observed API category metadata.
// Usage:
//   npm run seed:food-categories -- --dry-run
//   npm run seed:food-categories
//   npm run seed:food-categories -- "whole milk" "peanut butter"

import { config } from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fdcApiKey = process.env.VITE_FDC_API_KEY;
const dryRun = process.argv.includes("--dry-run");
const explicitQueries = process.argv
	.slice(2)
	.filter((argument) => !argument.startsWith("--"));

const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FDC_URL = "https://api.nal.usda.gov/fdc/v1";
const REQUEST_DELAY_MS = 140;
const PAGE_SIZE = 12;
const FDC_BRANDED_DETAIL_SIZE = 8;
const MAX_CATEGORY_LENGTH = 80;

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

const queries = explicitQueries.length > 0 ? explicitQueries : DEFAULT_QUERIES;

const sleep = (milliseconds) =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});

const normalizeValue = (value) =>
	String(value ?? "")
		.toLocaleLowerCase()
		.trim()
		.replace(/^[a-z]{2}:/i, "")
		.replace(/&/g, " and ")
		.replace(/-/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const toTitleCase = (value) =>
	normalizeValue(value)
		.split(" ")
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toLocaleUpperCase()}${part.slice(1)}`)
		.join(" ");

const toCategoryId = (value) => normalizeValue(value).replace(/\s+/g, "-");

const cleanSourceCategory = (value) => {
	const normalized = normalizeValue(value);
	if (!normalized) return null;
	if (normalized.length > MAX_CATEGORY_LENGTH) return null;
	if (/^\d+$/.test(normalized)) return null;
	if (["foods", "food", "products", "product"].includes(normalized)) return null;
	return {
		category_id: toCategoryId(normalized),
		label: toTitleCase(normalized),
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
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
	}
	return await response.json();
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
		"main_category",
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
				"user-agent": "blendCalc/1.0 (category observation seed)",
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
			main_category: product.main_category ?? null,
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
	}
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

		for (const value of getFoodCategoryValues(detail.foodCategory ?? food.foodCategory)) {
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
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error(
			"Add PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.moderation.local.",
		);
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			detectSessionInUrl: false,
			persistSession: false,
		},
		realtime: {
			transport: WebSocket,
		},
	});
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
};

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

const categories = [...observations.values()].reduce((summary, observation) => {
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
}, new Map());

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
	await upsertCategoryObservations();
	console.log("Seeded custom food category observations and rebuilt options.");
}
