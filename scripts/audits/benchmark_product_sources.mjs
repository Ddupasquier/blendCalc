import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	findFirstBarcodeCandidateMatch,
	normalizeBarcode,
} from "../lib/barcode_candidates.mjs";
import { createAppUserAgent } from "../lib/app_version.mjs";

const APP_USER_AGENT = createAppUserAgent("source quality benchmark");

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const usdaApiKey = process.env.FDC_API_KEY || process.env.VITE_FDC_API_KEY;
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const requestedLimit = Number.parseInt(limitArgument?.split("=")[1] ?? "10", 10);
const limit = Math.min(Math.max(requestedLimit, 1), 200);
const resetToday = process.argv.includes("--reset-today");

if (!supabaseUrl || !serviceRoleKey || !usdaApiKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FDC_API_KEY or VITE_FDC_API_KEY are required.",
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

if (resetToday) {
	const metricDate = new Date().toISOString().slice(0, 10);
	const { error } = await supabase
		.from("product_source_daily_metrics")
		.delete()
		.eq("metric_date", metricDate)
		.eq("lookup_origin", "benchmark");
	if (error) throw error;
	console.log(`Cleared ${metricDate} benchmark metrics before this controlled run.`);
}

const sleep = (milliseconds) => new Promise((resolve) => {
	setTimeout(resolve, milliseconds);
});
const numeric = (value) =>
	value !== null && value !== "" && Number.isFinite(Number(value));
const hasText = (value) => Boolean(String(value ?? "").trim());
const sourceDate = (food) => Date.parse(
	food.publishedDate
	|| food.publicationDate
	|| food.modifiedDate
	|| food.availableDate
	|| "",
) || 0;
const selectNewestUsdaMatch = (foods, barcode) => foods
	.filter((food) =>
		food.dataType === "Branded"
		&& normalizeBarcode(food.gtinUpc) === barcode
	)
	.sort((left, right) => {
		const activeDifference = Number(Boolean(left.discontinuedDate))
			- Number(Boolean(right.discontinuedDate));
		return activeDifference || sourceDate(right) - sourceDate(left) || right.fdcId - left.fdcId;
	})[0] ?? null;

const fetchTracked = async (url, options, trace) => {
	const retryableStatuses = new Set([429, 500, 502, 503, 504]);
	for (let attempt = 0; attempt < 4; attempt += 1) {
		trace.apiRequestCount += 1;
		let response;
		try {
			response = await fetch(url, options);
		} catch (error) {
			trace.apiErrorCount += 1;
			if (attempt === 3) throw error;
			await sleep(750 * (2 ** attempt));
			continue;
		}
		if (response.ok || response.status === 404) return response;
		trace.apiErrorCount += 1;
		if (!retryableStatuses.has(response.status) || attempt === 3) {
			throw new Error(`${url} returned ${response.status}.`);
		}
		const retryAfter = Number(response.headers.get("retry-after"));
		await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 750 * (2 ** attempt));
	}
	throw new Error(`Unable to fetch ${url}.`);
};

const benchmarkUsda = async (barcode) => {
	const trace = { apiRequestCount: 0, apiErrorCount: 0 };
	const startedAt = Date.now();
	try {
		const candidateMatch = await findFirstBarcodeCandidateMatch(
			barcode,
			async (candidate) => {
				const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
				url.searchParams.set("api_key", usdaApiKey);
				url.searchParams.set("query", candidate);
				url.searchParams.set("dataType", "Branded");
				url.searchParams.set("pageSize", "50");
				const response = await fetchTracked(
					url,
					{ headers: { accept: "application/json" } },
					trace,
				);
				if (response.status === 404) return null;
				const data = await response.json();
				return selectNewestUsdaMatch(data.foods ?? [], barcode);
			},
		);
		const match = candidateMatch?.value ?? null;
		if (!match) return { outcome: "not-found", trace, startedAt };

		const detailUrl = new URL(`https://api.nal.usda.gov/fdc/v1/food/${match.fdcId}`);
		detailUrl.searchParams.set("api_key", usdaApiKey);
		const detailResponse = await fetchTracked(
			detailUrl,
			{ headers: { accept: "application/json" } },
			trace,
		);
		const food = await detailResponse.json();
		return {
			outcome: "matched",
			trace,
			startedAt,
			sourceDataType: food.dataType ?? "Branded",
			quality: {
				reportedNutrientCount: new Set(
					(food.foodNutrients ?? []).map((entry) =>
						entry.nutrient?.id ?? entry.nutrientId
					).filter(Boolean),
				).size,
				hasBrand: hasText(food.brandOwner),
				hasCategory: hasText(food.brandedFoodCategory || food.foodCategory),
				hasServing: Number(food.servingSize) > 0 && hasText(food.servingSizeUnit),
				hasIngredients: hasText(food.ingredients),
				hasImage: Boolean(food.image?.imageUrl),
			},
		};
	} catch (error) {
		return { outcome: "error", trace, startedAt, error };
	}
};

const openFoodFactsFields = [
	"code",
	"product_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"categories",
	"categories_tags",
	"image_front_url",
	"image_url",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"nutriments",
].join(",");

const benchmarkOpenFoodFacts = async (barcode, nutrientMappings) => {
	const trace = { apiRequestCount: 0, apiErrorCount: 0 };
	const startedAt = Date.now();
	try {
		const candidateMatch = await findFirstBarcodeCandidateMatch(
			barcode,
			async (candidate) => {
				const url = new URL(
					`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json`,
				);
				url.searchParams.set("fields", openFoodFactsFields);
				const response = await fetchTracked(url, {
					headers: {
						accept: "application/json",
						"user-agent": APP_USER_AGENT,
					},
				}, trace);
				if (response.status === 404) return null;
				const data = await response.json();
				if (data.status !== 1 || !data.product) return null;
				if (normalizeBarcode(data.product.code ?? candidate) !== barcode) {
					return null;
				}
				const product = data.product;
				const nutrientIds = new Set(nutrientMappings.flatMap((mapping) => {
					const per100Value = product.nutriments?.[
						`${mapping.source_nutrient_key}_100g`
					];
					const servingValue = product.nutriments?.[
						`${mapping.source_nutrient_key}_serving`
					];
					return numeric(per100Value) || numeric(servingValue)
						? [mapping.nutrient_id]
						: [];
				}));
				return {
					outcome: "matched",
					trace,
					startedAt,
					quality: {
						reportedNutrientCount: nutrientIds.size,
						hasBrand: hasText(product.brands),
						hasCategory:
							hasText(product.categories)
							|| product.categories_tags?.length > 0,
						hasServing:
							hasText(product.serving_size)
							|| Number(product.serving_quantity) > 0,
						hasIngredients: hasText(
							product.ingredients_text_en || product.ingredients_text,
						),
						hasImage: hasText(
							product.image_front_url || product.image_url,
						),
					},
				};
			},
		);
		if (candidateMatch) return candidateMatch.value;
		return { outcome: "not-found", trace, startedAt };
	} catch (error) {
		return { outcome: "error", trace, startedAt, error };
	}
};

const recordBenchmark = async (sourceKey, result) => {
	const matched = result.outcome === "matched";
	const completed = result.outcome !== "error";
	const quality = matched ? result.quality : undefined;
	const { error } = await supabase.rpc("record_product_source_daily_metric", {
		p_source_key: sourceKey,
		p_source_data_type: result.sourceDataType ?? "",
		p_lookup_kind: "barcode",
		p_lookup_origin: "benchmark",
		p_lookup_count: 1,
		p_api_request_count: result.trace.apiRequestCount,
		p_api_error_count: result.trace.apiErrorCount,
		p_cache_hit_count: 0,
		p_completed_lookup_count: completed ? 1 : 0,
		p_match_count: matched ? 1 : 0,
		p_exact_barcode_match_count: matched ? 1 : 0,
		p_error_count: result.outcome === "error" ? 1 : 0,
		p_evaluated_product_count: quality ? 1 : 0,
		p_reported_nutrient_total: quality?.reportedNutrientCount ?? 0,
		p_brand_present_count: quality?.hasBrand ? 1 : 0,
		p_category_present_count: quality?.hasCategory ? 1 : 0,
		p_serving_present_count: quality?.hasServing ? 1 : 0,
		p_ingredients_present_count: quality?.hasIngredients ? 1 : 0,
		p_image_present_count: quality?.hasImage ? 1 : 0,
		p_response_milliseconds_total: Math.max(0, Date.now() - result.startedAt),
	});
	if (error) throw error;
};

const [{ data: products, error: productError }, { data: nutrientMappings, error: mappingError }] =
	await Promise.all([
		supabase
			.from("shared_products")
			.select("barcode, product_name")
			.eq("status", "active")
			.order("created_at", { ascending: true })
			.limit(limit),
		supabase
			.from("nutrient_source_mappings")
			.select("source_nutrient_key, nutrient_id")
			.eq("source_key", "open-food-facts")
			.eq("enabled", true),
	]);

if (productError) throw productError;
if (mappingError) throw mappingError;
if (!products?.length) throw new Error("No active shared-product barcodes are available.");

const runResults = {
	usda: [],
	"open-food-facts": [],
};

for (const [index, product] of products.entries()) {
	const barcode = normalizeBarcode(product.barcode);
	if (!barcode) {
		console.warn(`${index + 1}/${products.length} ${product.product_name}: invalid barcode skipped`);
		continue;
	}
	const [usda, openFoodFacts] = await Promise.all([
		benchmarkUsda(barcode),
		benchmarkOpenFoodFacts(barcode, nutrientMappings ?? []),
	]);
	await Promise.all([
		recordBenchmark("usda", usda),
		recordBenchmark("open-food-facts", openFoodFacts),
	]);
	runResults.usda.push(usda);
	runResults["open-food-facts"].push(openFoodFacts);
	console.log(
		`${index + 1}/${products.length} ${product.product_name}: USDA ${usda.outcome}, Open Food Facts ${openFoodFacts.outcome}`,
	);
	await sleep(350);
}

console.table(Object.entries(runResults).map(([source, results]) => ({
	Source: source,
	Lookups: results.length,
	"API calls": results.reduce(
		(total, result) => total + result.trace.apiRequestCount,
		0,
	),
	"Calls / lookup": Number((results.reduce(
		(total, result) => total + result.trace.apiRequestCount,
		0,
	) / Math.max(results.length, 1)).toFixed(2)),
	Matches: results.filter((result) => result.outcome === "matched").length,
	Errors: results.filter((result) => result.outcome === "error").length,
})));

console.log(
	`Recorded an equal-barcode benchmark for ${products.length} products. Run npm run report:source-quality -- --origin=benchmark to compare results.`,
);
