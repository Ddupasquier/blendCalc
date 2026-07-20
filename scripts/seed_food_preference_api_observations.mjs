// Seed observed allergen, dietary, and ingredient reference data from food APIs.
// Usage:
//   npm run seed:food-preferences -- --dry-run
//   npm run seed:food-preferences
//   npm run seed:food-preferences -- "whole milk" "peanut butter"

import { config } from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createAppUserAgent } from "./lib/app_version.mjs";

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
const APP_USER_AGENT = createAppUserAgent("food preference observation seed");

const DEFAULT_QUERIES = [
	"whole milk",
	"2 percent milk",
	"greek yogurt",
	"whey protein",
	"cheddar cheese",
	"butter",
	"almond milk",
	"oat milk",
	"soy milk",
	"coconut milk",
	"peanut butter",
	"almond butter",
	"cashew butter",
	"trail mix",
	"wheat bread",
	"whole grain bread",
	"gluten free bread",
	"egg noodles",
	"mayonnaise",
	"tofu",
	"edamame",
	"soy sauce",
	"sesame tahini",
	"hummus",
	"mustard",
	"celery soup",
	"shrimp",
	"crab",
	"salmon",
	"tuna",
	"vegan cheese",
	"vegan protein bar",
	"vegetarian burger",
	"kosher pickles",
	"halal chicken",
	"pork sausage",
	"bacon",
	"gelatin dessert",
	"honey",
	"milk chocolate",
	"dark chocolate",
	"granola bar",
	"protein shake",
	"ice cream",
	"cereal",
	"pesto",
	"ranch dressing",
	"caesar dressing",
	"macaroni and cheese",
	"ramen noodles",
	"tortilla chips",
	"potato chips",
	"salsa",
	"curry sauce",
	"lentil soup",
	"black bean burger",
	"chicken broth",
	"beef jerky",
	"turkey slices",
	"plant based nuggets",
	"nut free granola",
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

const canonicalizeAllergen = (value) => {
	const normalized = normalizeValue(value);
	const checks = [
		["Milk", /\b(milk|dairy|lactose|casein|whey)\b/],
		["Egg", /\b(egg|eggs|albumen)\b/],
		["Soy", /\b(soy|soya|soybean|soybeans)\b/],
		["Wheat", /\b(wheat|durum|semolina)\b/],
		["Gluten", /\b(gluten|barley|rye|malt)\b/],
		["Peanut", /\b(peanut|peanuts)\b/],
		["Tree Nut", /\b(tree nut|tree nuts|almond|cashew|hazelnut|pecan|pistachio|walnut)\b/],
		["Fish", /\b(fish|anchovy|cod|salmon|tuna)\b/],
		["Shellfish", /\b(shellfish|shrimp|crab|lobster|crustacean|crustaceans)\b/],
		["Sesame", /\b(sesame|tahini)\b/],
		["Mustard", /\bmustard\b/],
		["Celery", /\bcelery\b/],
		["Lupin", /\blupin\b/],
	];

	return checks.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
};

const canonicalizeDietary = (value) => {
	const normalized = normalizeValue(value);
	const checks = [
		["Vegan", /\bvegan\b/],
		["Vegetarian", /\bvegetarian\b/],
		["Gluten-free", /\b(gluten free|without gluten|no gluten)\b/],
		["Dairy-free", /\b(dairy free|milk free|lactose free|without dairy)\b/],
		["Nut-free", /\b(nut free|peanut free|tree nut free)\b/],
		["Soy-free", /\b(soy free|soya free)\b/],
		["Egg-free", /\b(egg free|without egg|without eggs)\b/],
		["Halal", /\bhalal\b/],
		["Kosher", /\bkosher\b/],
	];

	return checks.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
};

const splitDelimitedValues = (value) =>
	String(value ?? "")
		.split(/[;,]/)
		.map((part) => part.trim())
		.filter(Boolean);

const cleanTag = (value) =>
	String(value ?? "")
		.replace(/^[a-z]{2}:/i, "")
		.replace(/-/g, " ")
		.trim();

const getUniqueValues = (values) => {
	const seen = new Set();
	const unique = [];

	for (const value of values) {
		const cleaned = cleanTag(value);
		const key = normalizeValue(cleaned);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(cleaned);
	}

	return unique;
};

const splitIngredients = (value) => {
	const text = String(value ?? "")
		.replace(/\([^)]*\)/g, ",")
		.replace(/\[[^\]]*\]/g, ",");

	return getUniqueValues(
		text
			.split(/[,;•]/)
			.map((part) =>
				part
					.replace(/\b(and|or|contains|less than|of|with)\b/gi, " ")
					.replace(/\d+(\.\d+)?\s*%/g, " ")
					.trim(),
			)
			.filter((part) => {
				const normalized = normalizeValue(part);
				return normalized.length >= 3 && normalized.length <= 80;
			}),
	);
};

const observationKey = (observation) =>
	[
		observation.source,
		observation.query,
		observation.category,
		observation.fact_type,
		observation.normalized_value,
		observation.source_field,
		observation.source_value,
	].join("\u001f");

const observations = new Map();

const addObservation = (observation) => {
	if (!observation.normalized_value || !observation.source_value) return;

	const key = observationKey(observation);
	const existing = observations.get(key);
	if (existing) {
		existing.observation_count += 1;
		return;
	}

	observations.set(key, {
		...observation,
		observation_count: 1,
	});
};

const addAllergenObservations = ({
	source,
	query,
	product,
	values,
	sourceField,
	factType,
}) => {
	for (const value of getUniqueValues(values)) {
		const label = canonicalizeAllergen(value);
		if (!label) continue;
		addObservation({
			source,
			query,
			matched_name: product.name,
			brand_owner: product.brandOwner,
			source_reference: product.sourceReference,
			category: "allergen",
			fact_type: factType,
			source_field: sourceField,
			source_value: value,
			label,
			normalized_value: normalizeValue(label),
			source_payload: product.payload,
		});
	}
};

const addDietaryObservations = ({ source, query, product, values, sourceField }) => {
	for (const value of getUniqueValues(values)) {
		const label = canonicalizeDietary(value);
		if (!label) continue;
		addObservation({
			source,
			query,
			matched_name: product.name,
			brand_owner: product.brandOwner,
			source_reference: product.sourceReference,
			category: "dietary",
			fact_type: "dietary_claim",
			source_field: sourceField,
			source_value: value,
			label,
			normalized_value: normalizeValue(label),
			source_payload: product.payload,
		});
	}
};

const addIngredientObservations = ({ source, query, product, ingredientText, sourceField }) => {
	for (const ingredient of splitIngredients(ingredientText)) {
		addObservation({
			source,
			query,
			matched_name: product.name,
			brand_owner: product.brandOwner,
			source_reference: product.sourceReference,
			category: "ingredient",
			fact_type: "ingredient_present",
			source_field: sourceField,
			source_value: ingredient,
			label: toTitleCase(ingredient),
			normalized_value: normalizeValue(ingredient),
			source_payload: product.payload,
		});
	}
};

const fetchJson = async (url, options = {}, label = "API request") => {
	const response = await fetch(url, options);
	if (!response.ok) {
		throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
	}
	return await response.json();
};

const collectOpenFoodFacts = async (query) => {
	const fields = [
		"code",
		"product_name",
		"brands",
		"ingredients_text",
		"ingredients_text_en",
		"allergens",
		"allergens_tags",
		"traces",
		"traces_tags",
		"labels",
		"labels_tags",
		"categories",
		"categories_tags",
	].join(",");
	const url = new URL(OPEN_FOOD_FACTS_URL);
	url.searchParams.set("search_terms", query);
	url.searchParams.set("search_simple", "1");
	url.searchParams.set("action", "process");
	url.searchParams.set("json", "1");
	url.searchParams.set("page_size", "3");
	url.searchParams.set("fields", fields);

	const data = await fetchJson(
		url,
		{
			headers: {
				accept: "application/json",
				"user-agent": APP_USER_AGENT,
			},
		},
		`Open Food Facts search for "${query}"`,
	);

	for (const productData of data.products ?? []) {
		const product = {
			name: productData.product_name ?? "Unnamed product",
			brandOwner: productData.brands ?? null,
			sourceReference: productData.code ? String(productData.code) : null,
			payload: {
				product_name: productData.product_name ?? null,
				brands: productData.brands ?? null,
				allergens: productData.allergens ?? null,
				allergens_tags: productData.allergens_tags ?? [],
				traces: productData.traces ?? null,
				traces_tags: productData.traces_tags ?? [],
				labels_tags: productData.labels_tags ?? [],
				categories_tags: productData.categories_tags ?? [],
			},
		};
		addAllergenObservations({
			source: "open-food-facts",
			query,
			product,
			values: [
				...splitDelimitedValues(productData.allergens),
				...(productData.allergens_tags ?? []),
			],
			sourceField: "allergens",
			factType: "contains",
		});
		addAllergenObservations({
			source: "open-food-facts",
			query,
			product,
			values: [
				...splitDelimitedValues(productData.traces),
				...(productData.traces_tags ?? []),
			],
			sourceField: "traces",
			factType: "may_contain",
		});
		addDietaryObservations({
			source: "open-food-facts",
			query,
			product,
			values: [
				...(productData.labels_tags ?? []),
				...(productData.categories_tags ?? []),
				...splitDelimitedValues(productData.labels),
				...splitDelimitedValues(productData.categories),
			],
			sourceField: "labels_categories",
		});
		addIngredientObservations({
			source: "open-food-facts",
			query,
			product,
			ingredientText: productData.ingredients_text_en ?? productData.ingredients_text,
			sourceField: "ingredients_text",
		});
	}
};

const buildFdcSearchUrl = (query, dataType) => {
	const url = new URL(`${FDC_URL}/foods/search`);
	url.searchParams.set("api_key", fdcApiKey);
	url.searchParams.set("query", query);
	url.searchParams.set("pageSize", "3");
	url.searchParams.set("dataType", dataType);
	return url;
};

const buildFdcDetailUrl = (fdcId) => {
	const url = new URL(`${FDC_URL}/food/${fdcId}`);
	url.searchParams.set("api_key", fdcApiKey);
	return url;
};

const collectFdcSearch = async (query) => {
	if (!fdcApiKey || fdcApiKey === "your_api_key_here") return;
	const data = await fetchJson(
		buildFdcSearchUrl(query, "Foundation,SR Legacy,Branded"),
		{},
		`FDC search for "${query}"`,
	);

	for (const food of data.foods ?? []) {
		const product = {
			name: food.description ?? "Unnamed food",
			brandOwner: food.brandOwner ?? null,
			sourceReference: food.fdcId ? String(food.fdcId) : null,
			payload: {
				fdcId: food.fdcId ?? null,
				dataType: food.dataType ?? null,
				description: food.description ?? null,
				brandOwner: food.brandOwner ?? null,
				ingredients: food.ingredients ?? null,
			},
		};
		addIngredientObservations({
			source: "fdc-search",
			query,
			product,
			ingredientText: food.ingredients,
			sourceField: "ingredients",
		});
	}
};

const collectUsdaBrandedDetail = async (query) => {
	if (!fdcApiKey || fdcApiKey === "your_api_key_here") return;
	const searchData = await fetchJson(
		buildFdcSearchUrl(query, "Branded"),
		{},
		`USDA branded search for "${query}"`,
	);

	for (const food of searchData.foods ?? []) {
		if (!food.fdcId) continue;
		await sleep(REQUEST_DELAY_MS);
		const detail = await fetchJson(
			buildFdcDetailUrl(food.fdcId),
			{},
			`USDA branded detail for "${query}"`,
		);
		const product = {
			name: detail.description ?? food.description ?? "Unnamed branded food",
			brandOwner: detail.brandOwner ?? food.brandOwner ?? null,
			sourceReference: String(food.fdcId),
			payload: {
				fdcId: food.fdcId,
				dataType: detail.dataType ?? food.dataType ?? null,
				description: detail.description ?? food.description ?? null,
				brandOwner: detail.brandOwner ?? food.brandOwner ?? null,
				ingredients: detail.ingredients ?? null,
			},
		};
		addIngredientObservations({
			source: "usda-branded-detail",
			query,
			product,
			ingredientText: detail.ingredients,
			sourceField: "ingredients",
		});
	}
};

const upsertObservations = async () => {
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
			.from("food_preference_api_observations")
			.upsert(chunk, {
				onConflict:
					"source,query,category,fact_type,normalized_value,source_field,source_value",
			});
		if (error) throw error;
	}

	const { error: rebuildError } = await supabase.rpc(
		"rebuild_food_preference_option_catalog",
	);
	if (rebuildError) throw rebuildError;
};

for (const [index, query] of queries.entries()) {
	console.log(`[${index + 1}/${queries.length}] ${query}`);
	try {
		await collectOpenFoodFacts(query);
	} catch (error) {
		console.warn(error instanceof Error ? error.message : error);
	}
	await sleep(REQUEST_DELAY_MS);
	try {
		await collectFdcSearch(query);
	} catch (error) {
		console.warn(error instanceof Error ? error.message : error);
	}
	await sleep(REQUEST_DELAY_MS);
	try {
		await collectUsdaBrandedDetail(query);
	} catch (error) {
		console.warn(error instanceof Error ? error.message : error);
	}
	await sleep(REQUEST_DELAY_MS);
}

const summary = [...observations.values()].reduce(
	(total, observation) => {
		total[observation.category] += observation.observation_count;
		total.sources.add(observation.source);
		return total;
	},
	{ allergen: 0, dietary: 0, ingredient: 0, sources: new Set() },
);

console.log(
	`Collected ${observations.size} unique observations across ${summary.sources.size} sources.`,
);
console.table({
	allergen: summary.allergen,
	dietary: summary.dietary,
	ingredient: summary.ingredient,
});

if (dryRun) {
	console.log("Dry run complete. No rows were written.");
} else {
	await upsertObservations();
	console.log("Food preference API observations saved and option catalog rebuilt.");
}
