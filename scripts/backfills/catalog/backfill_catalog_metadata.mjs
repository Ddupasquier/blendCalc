/**
 * Purpose: Backfill missing canonical product brands, ingredients, explicit allergen
 * and precautionary metadata, label metadata, package quantity, source-record
 * dates/markets, and legitimate source servings from exact USDA barcode records. The
 * workflow reads the provider cache first,
 * makes bounded live requests only for cache misses, records field-level evidence through
 * the canonical enrichment RPC, and warms the licensed Open Food Facts cache for metadata
 * USDA does not provide. Open Food Facts data is not promoted into the public canonical
 * catalog while its canonical-storage policy remains disabled.
 * Preview: `node scripts/backfills/catalog/backfill_catalog_metadata.mjs --dry-run`
 * Execute: `node scripts/backfills/catalog/backfill_catalog_metadata.mjs`
 * Cached only: `node scripts/backfills/catalog/backfill_catalog_metadata.mjs --cached-only`
 */

import { createHash } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	findFirstBarcodeCandidateMatch,
	normalizeBarcode,
} from "../../lib/barcode/barcode_candidates.mjs";
import { createAppUserAgent } from "../../lib/releases/app_version.mjs";
import { extractExplicitAllergenDeclarations } from "../../../src/lib/server/products/allergenDeclarations.server.js";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const isDryRun = process.argv.includes("--dry-run");
const cachedOnly = process.argv.includes("--cached-only");
const limitArgument = process.argv.find((argument) =>
	argument.startsWith("--limit="),
);
const limit = limitArgument
	? Number.parseInt(limitArgument.split("=")[1] ?? "", 10)
	: null;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fdcApiKey = process.env.FDC_API_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
}
if (!cachedOnly && !fdcApiKey) {
	throw new Error("FDC_API_KEY is required unless --cached-only is used.");
}
if (limitArgument && (!Number.isSafeInteger(limit) || limit <= 0)) {
	throw new Error("--limit must be a positive integer.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: { transport: WebSocket },
});

const APP_USER_AGENT = createAppUserAgent("catalog metadata backfill");
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"ingredients",
	"ingredients_tags",
	"ingredients_analysis_tags",
	"ingredients_percent_analysis",
	"ingredients_percent_estimate",
	"ingredients_percent_known",
	"ingredients_percent_unknown",
	"allergens",
	"allergens_tags",
	"allergens_hierarchy",
	"allergens_lc",
	"traces",
	"traces_tags",
	"traces_hierarchy",
	"traces_lc",
	"traces_from_ingredients",
	"traces_from_user",
	"additives_tags",
	"labels",
	"labels_tags",
	"categories",
	"categories_tags",
	"categories_hierarchy",
	"food_groups",
	"food_groups_tags",
	"image_front_url",
	"image_front_small_url",
	"image_front_thumb_url",
	"image_url",
	"image_small_url",
	"image_thumb_url",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"quantity",
	"product_quantity",
	"product_quantity_unit",
	"lang",
	"languages_tags",
	"countries",
	"countries_tags",
	"created_t",
	"last_modified_t",
	"last_updated_t",
	"rev",
	"schema_version",
	"completeness",
	"data_quality_tags",
	"data_quality_errors_tags",
	"data_quality_warnings_tags",
	"obsolete",
	"obsolete_since_date",
	"tags_sources",
	"nutriments",
].join(",");
const OPEN_FOOD_FACTS_LEGACY_FIELDS = OPEN_FOOD_FACTS_FIELDS.split(",")
	.filter((field) => field !== "countries" && field !== "countries_tags")
	.join(",");
const RETRY_DELAYS_MS = [750, 2_000];
const REQUEST_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 12_000;
const USDA_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const OPEN_FOOD_FACTS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const SUPPLEMENTAL_ENRICHMENT_FIELDS = new Set([
	"brandOwner",
	"precautionaryStatements",
]);

const sleep = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const formatError = (error) => {
	if (error instanceof Error) return error.message;
	if (error && typeof error === "object") {
		return JSON.stringify(error);
	}
	return String(error);
};

const toCacheKey = (requestKind, cacheValue) =>
	createHash("sha256")
		.update(JSON.stringify({ kind: requestKind, value: cacheValue }))
		.digest("hex");

const createContentHash = (value) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

const fetchJson = async (url, options, label) => {
	let lastError;
	for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
		try {
			const response = await fetch(url, {
				...options,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
			if (response.ok) return await response.json();
			if (response.status === 404) return null;
			if (!RETRYABLE_STATUS_CODES.has(response.status)) {
				throw new Error(`${label} failed with ${response.status}.`);
			}
			lastError = new Error(`${label} failed with ${response.status}.`);
		} catch (error) {
			lastError = error;
		}
		if (attempt < RETRY_DELAYS_MS.length) {
			await sleep(RETRY_DELAYS_MS[attempt]);
		}
	}
	throw new Error(
		`${label} failed after bounded retries: ${lastError?.message ?? lastError}`,
	);
};

const upsertApiCache = async ({
	provider,
	requestKind,
	cacheValue,
	response,
	statusCode = 200,
	ttlMilliseconds,
}) => {
	if (isDryRun) return;
	const fetchedAt = new Date();
	const { error } = await supabase.from("product_api_cache").upsert({
		provider,
		cache_key: toCacheKey(requestKind, cacheValue),
		request_kind: requestKind,
		status_code: statusCode,
		response,
		fetched_at: fetchedAt.toISOString(),
		expires_at: new Date(fetchedAt.getTime() + ttlMilliseconds).toISOString(),
		etag: null,
	});
	if (error) throw error;
};

const readApiCache = async (provider, requestKind, cacheValue) => {
	const cacheKey = toCacheKey(requestKind, cacheValue);
	const { data, error } = await supabase
		.from("product_api_cache")
		.select("response, expires_at")
		.eq("provider", provider)
		.eq("cache_key", cacheKey)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	if (!cachedOnly && Date.parse(data.expires_at) <= Date.now()) return null;
	return data.response;
};

const cleanValues = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const cleaned = String(value ?? "")
			.replace(/^[a-z]{2}:/i, "")
			.replace(/-/g, " ")
			.trim();
		const key = cleaned.toLocaleLowerCase("en-US");
		if (!cleaned || seen.has(key)) return [];
		seen.add(key);
		return [cleaned];
	});
};

const splitIngredientList = (value) =>
	cleanValues(String(value ?? "").split(/,(?![^(]*\))/));

const toSourceTimestamp = (value) => {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) return undefined;
	const dateParts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (dateParts) {
		const month = Number(dateParts[1]);
		const day = Number(dateParts[2]);
		const year = Number(dateParts[3]);
		const date = new Date(Date.UTC(year, month - 1, day));
		if (
			date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
		) {
			return date.toISOString();
		}
		return undefined;
	}
	const timestamp = Date.parse(trimmed);
	return Number.isFinite(timestamp)
		? new Date(timestamp).toISOString()
		: undefined;
};

const hasValues = (value) =>
	Array.isArray(value) && value.some((item) => String(item ?? "").trim());

const parseSourceServing = (food) => {
	const quantity = Number(food?.servingSize);
	const unit = String(food?.servingSizeUnit ?? "")
		.trim()
		.toLocaleLowerCase();
	const factors = new Map([
		["g", 1],
		["gram", 1],
		["grams", 1],
		["grm", 1],
		["mg", 0.001],
		["kg", 1_000],
		["oz", 28.349523125],
		["ounce", 28.349523125],
		["ounces", 28.349523125],
		["lb", 453.59237],
		["pound", 453.59237],
		["pounds", 453.59237],
	]);
	const factor = factors.get(unit);
	if (!Number.isFinite(quantity) || quantity <= 0 || !factor) return null;
	const gramWeight = quantity * factor;
	const label =
		String(food?.householdServingFullText ?? "").trim() ||
		`${quantity} ${food.servingSizeUnit}`;
	return {
		servingSize: gramWeight,
		servingSizeUnit: "g",
		householdServingFullText: label,
		hasSourceServing: true,
		foodServings: [
			{
				label,
				gramWeight,
				isPrimary: true,
				source: "usda",
				sourceReference: String(food.fdcId),
				confidence: "unknown",
			},
		],
		customServingLabel: label,
		customServingWeightGrams: gramWeight,
	};
};

const getUsdaMetadata = (food) => {
	const ingredients = String(food?.ingredients ?? "").trim();
	const declarations = extractExplicitAllergenDeclarations(ingredients);
	const brandOwner = String(food?.brandOwner || food?.brandName || "").trim();
	const packageLabel = String(food?.packageWeight ?? "").trim();
	const marketCountry = String(food?.marketCountry ?? "").trim();
	const publishedAt = toSourceTimestamp(
		food?.publishedDate ?? food?.publicationDate,
	);
	const availableAt = toSourceTimestamp(food?.availableDate);
	const modifiedAt = toSourceTimestamp(food?.modifiedDate);
	const discontinuedAt = toSourceTimestamp(food?.discontinuedDate);
	const sourceMetadata = {
		...(publishedAt ? { publishedAt } : {}),
		...(availableAt ? { availableAt } : {}),
		...(modifiedAt ? { modifiedAt } : {}),
		...(discontinuedAt ? { discontinuedAt } : {}),
		...(marketCountry ? { marketCountries: [marketCountry] } : {}),
	};
	return {
		brandOwner: brandOwner || undefined,
		ingredients: ingredients || undefined,
		ingredientList: splitIngredientList(ingredients),
		allergens: cleanValues([
			...(food?.allergens ?? []),
			...declarations.contains,
		]),
		traces: cleanValues([...(food?.traces ?? []), ...declarations.mayContain]),
		precautionaryStatements: declarations.precautionaryStatements,
		dietaryTags: cleanValues(food?.dietaryTags ?? []),
		labels: cleanValues(food?.labels ?? []),
		packageQuantity: packageLabel ? { label: packageLabel } : undefined,
		sourceMetadata:
			Object.keys(sourceMetadata).length > 0 ? sourceMetadata : undefined,
		serving: parseSourceServing(food),
	};
};

const getMissingFields = (food, brandOwner) => ({
	brandOwner: !String(brandOwner ?? food?.brandOwner ?? "").trim(),
	ingredients:
		!String(food?.ingredients ?? "").trim() || !hasValues(food?.ingredientList),
	allergens: !hasValues(food?.allergens),
	traces: !hasValues(food?.traces),
	precautionaryStatements: !hasValues(food?.precautionaryStatements),
	dietaryTags: !hasValues(food?.dietaryTags),
	labels: !hasValues(food?.labels),
	structuredIngredients: !hasValues(food?.structuredIngredients),
	ingredientAnalysis:
		!food?.ingredientAnalysis ||
		Object.keys(food.ingredientAnalysis).length === 0,
	additives: !hasValues(food?.additives),
	package:
		!food?.packageQuantity || Object.keys(food.packageQuantity).length === 0,
	sourceMetadata:
		!food?.sourceMetadata || Object.keys(food.sourceMetadata).length === 0,
	serving:
		food?.hasSourceServing !== true ||
		!Number.isFinite(
			Number(food?.customServingWeightGrams ?? food?.servingSize),
		) ||
		Number(food?.customServingWeightGrams ?? food?.servingSize) <= 0,
});

const getUsdaCandidateFields = (product, metadata) => {
	const missing = getMissingFields(product.food, product.brand_owner);
	return [
		missing.brandOwner && metadata.brandOwner ? "brandOwner" : null,
		missing.ingredients && metadata.ingredients ? "ingredients" : null,
		missing.allergens && metadata.allergens.length > 0 ? "allergens" : null,
		missing.traces && metadata.traces.length > 0 ? "traces" : null,
		missing.precautionaryStatements &&
		metadata.precautionaryStatements.length > 0
			? "precautionaryStatements"
			: null,
		missing.dietaryTags && metadata.dietaryTags.length > 0
			? "dietaryTags"
			: null,
		missing.labels && metadata.labels.length > 0 ? "labels" : null,
		missing.package && metadata.packageQuantity ? "package" : null,
		missing.sourceMetadata && metadata.sourceMetadata ? "sourceMetadata" : null,
		missing.serving && metadata.serving ? "serving" : null,
	].filter(Boolean);
};

const applyUsdaMetadata = (currentFood, metadata, sourceReference, fields) => {
	const fieldSet = new Set(fields);
	const source = {
		source: "usda",
		sourceReference,
		confidence: "source-verified",
	};
	return {
		...currentFood,
		...(fieldSet.has("brandOwner") ? { brandOwner: metadata.brandOwner } : {}),
		...(fieldSet.has("ingredients")
			? {
					ingredients: metadata.ingredients,
					ingredientList: metadata.ingredientList,
				}
			: {}),
		...(fieldSet.has("allergens") ? { allergens: metadata.allergens } : {}),
		...(fieldSet.has("traces") ? { traces: metadata.traces } : {}),
		...(fieldSet.has("precautionaryStatements")
			? { precautionaryStatements: metadata.precautionaryStatements }
			: {}),
		...(fieldSet.has("dietaryTags")
			? { dietaryTags: metadata.dietaryTags }
			: {}),
		...(fieldSet.has("labels") ? { labels: metadata.labels } : {}),
		...(fieldSet.has("package")
			? { packageQuantity: metadata.packageQuantity }
			: {}),
		...(fieldSet.has("sourceMetadata")
			? { sourceMetadata: metadata.sourceMetadata }
			: {}),
		...(fieldSet.has("serving") ? metadata.serving : {}),
		fieldProvenance: {
			...(currentFood?.fieldProvenance ?? {}),
			...Object.fromEntries(fields.map((field) => [field, source])),
		},
	};
};

const getTrackedFieldValue = (food, field) => {
	switch (field) {
		case "brandOwner":
			return food.brandOwner ?? null;
		case "ingredients":
			return {
				ingredients: food.ingredients ?? null,
				ingredientList: food.ingredientList ?? [],
			};
		case "serving":
			return {
				label: food.customServingLabel ?? food.householdServingFullText ?? null,
				weightGrams: food.customServingWeightGrams ?? food.servingSize ?? null,
				foodServings: food.foodServings ?? [],
			};
		case "package":
			return food.packageQuantity ?? null;
		case "sourceMetadata":
			return food.sourceMetadata ?? null;
		default:
			return food[field] ?? [];
	}
};

const lookupCachedUsdaDetail = async (product) => {
	const canonicalBarcode = normalizeBarcode(product.barcode);
	if (!canonicalBarcode) return null;
	const sourceReference = String(
		product.source_reference ?? product.food?.sourceReference ?? "",
	);
	if (/^[0-9]+$/.test(sourceReference)) {
		const detail = await readApiCache("usda", "food-detail", {
			fdcId: Number(sourceReference),
		});
		if (normalizeBarcode(detail?.gtinUpc) === canonicalBarcode) return detail;
	}

	const match = await findFirstBarcodeCandidateMatch(
		product.barcode,
		async (candidate) => {
			const response = await readApiCache("usda", "barcode-search", {
				query: candidate,
				dataType: "Branded",
				pageSize: 50,
			});
			const exact = (response?.foods ?? []).find(
				(food) => normalizeBarcode(food.gtinUpc) === canonicalBarcode,
			);
			return exact?.fdcId ? { fdcId: exact.fdcId } : null;
		},
	);
	if (!match) return null;
	const detail = await readApiCache("usda", "food-detail", {
		fdcId: Number(match.value.fdcId),
	});
	return normalizeBarcode(detail?.gtinUpc) === canonicalBarcode ? detail : null;
};

const fetchUsdaDetail = async (product) => {
	if (cachedOnly) return null;
	const canonicalBarcode = normalizeBarcode(product.barcode);
	if (!canonicalBarcode) return null;

	const sourceReference = String(
		product.source_reference ?? product.food?.sourceReference ?? "",
	);
	if (/^[0-9]+$/.test(sourceReference)) {
		const detailUrl = new URL(`${USDA_BASE_URL}/food/${sourceReference}`);
		detailUrl.searchParams.set("api_key", fdcApiKey);
		const detail = await fetchJson(
			detailUrl,
			{ headers: { accept: "application/json" } },
			`USDA detail ${sourceReference}`,
		);
		if (normalizeBarcode(detail?.gtinUpc) === canonicalBarcode) {
			await upsertApiCache({
				provider: "usda",
				requestKind: "food-detail",
				cacheValue: { fdcId: Number(sourceReference) },
				response: detail,
				ttlMilliseconds: USDA_CACHE_TTL_MS,
			});
			return detail;
		}
	}

	const match = await findFirstBarcodeCandidateMatch(
		product.barcode,
		async (candidate) => {
			const searchUrl = new URL(`${USDA_BASE_URL}/foods/search`);
			searchUrl.searchParams.set("api_key", fdcApiKey);
			searchUrl.searchParams.set("query", candidate);
			searchUrl.searchParams.set("dataType", "Branded");
			searchUrl.searchParams.set("pageSize", "50");
			const cacheValue = {
				query: candidate,
				dataType: "Branded",
				pageSize: 50,
			};
			const response = await fetchJson(
				searchUrl,
				{ headers: { accept: "application/json" } },
				`USDA barcode search ${candidate}`,
			);
			await upsertApiCache({
				provider: "usda",
				requestKind: "barcode-search",
				cacheValue,
				response,
				ttlMilliseconds: USDA_CACHE_TTL_MS,
			});
			const exact = (response?.foods ?? []).find(
				(food) => normalizeBarcode(food.gtinUpc) === canonicalBarcode,
			);
			return exact?.fdcId ? { fdcId: exact.fdcId } : null;
		},
	);
	if (!match) return null;

	const detailUrl = new URL(`${USDA_BASE_URL}/food/${match.value.fdcId}`);
	detailUrl.searchParams.set("api_key", fdcApiKey);
	const detail = await fetchJson(
		detailUrl,
		{ headers: { accept: "application/json" } },
		`USDA detail ${match.value.fdcId}`,
	);
	if (normalizeBarcode(detail?.gtinUpc) !== canonicalBarcode) return null;
	await upsertApiCache({
		provider: "usda",
		requestKind: "food-detail",
		cacheValue: { fdcId: Number(match.value.fdcId) },
		response: detail,
		ttlMilliseconds: USDA_CACHE_TTL_MS,
	});
	return detail;
};

const lookupOpenFoodFacts = async (barcode) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;
	return (
		(
			await findFirstBarcodeCandidateMatch(barcode, async (candidate) => {
				const cacheValue = { candidate, fields: OPEN_FOOD_FACTS_FIELDS };
				const cached = await readApiCache(
					"open-food-facts",
					"barcode-product",
					cacheValue,
				);
				const compatibleCached =
					cached ??
					(cachedOnly
						? await readApiCache("open-food-facts", "barcode-product", {
								candidate,
								fields: OPEN_FOOD_FACTS_LEGACY_FIELDS,
							})
						: null);
				if (compatibleCached) {
					const product = compatibleCached?.product;
					return normalizeBarcode(product?.code ?? candidate) ===
						canonicalBarcode
						? compatibleCached
						: null;
				}
				if (cachedOnly) return null;
				const url = new URL(
					`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(candidate)}.json`,
				);
				url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
				const response = await fetchJson(
					url,
					{
						headers: {
							accept: "application/json",
							"user-agent": APP_USER_AGENT,
						},
					},
					`Open Food Facts metadata ${candidate}`,
				);
				await upsertApiCache({
					provider: "open-food-facts",
					requestKind: "barcode-product",
					cacheValue,
					response,
					statusCode: response ? 200 : 404,
					ttlMilliseconds: OPEN_FOOD_FACTS_CACHE_TTL_MS,
				});
				if (!response || response.status !== 1 || !response.product)
					return null;
				return normalizeBarcode(response.product.code ?? candidate) ===
					canonicalBarcode
					? response
					: null;
			})
		)?.value ?? null
	);
};

const [
	{ data: sourceRows, error: sourceError },
	{ data: productRows, error: productError },
] = await Promise.all([
	supabase
		.from("product_data_sources")
		.select("key, enabled, canonical_storage_allowed, canonical_license_name")
		.in("key", ["usda", "open-food-facts"]),
	supabase
		.from("shared_products")
		.select(
			"id, barcode, product_name, brand_owner, source, source_reference, food, category_option_id",
		)
		.eq("status", "active")
		.order("barcode"),
]);

if (sourceError) throw sourceError;
if (productError) throw productError;
const sourcePolicies = new Map((sourceRows ?? []).map((row) => [row.key, row]));
const usdaPolicy = sourcePolicies.get("usda");
if (
	!usdaPolicy?.enabled ||
	!usdaPolicy.canonical_storage_allowed ||
	!usdaPolicy.canonical_license_name
) {
	throw new Error(
		"USDA canonical storage policy is not approved in the database.",
	);
}

const products = Number.isSafeInteger(limit)
	? (productRows ?? []).slice(0, limit)
	: (productRows ?? []);
const summary = {
	products: products.length,
	usdaCacheHits: 0,
	usdaLiveMatches: 0,
	usdaMisses: 0,
	productsUpdated: 0,
	fieldsUpdated: 0,
	openFoodFactsMetadataCached: 0,
	providerWarnings: 0,
	errors: 0,
};

for (const [index, product] of products.entries()) {
	const missing = getMissingFields(product.food, product.brand_owner);
	if (!Object.values(missing).some(Boolean)) continue;
	console.log(
		`[${index + 1}/${products.length}] ${product.barcode} — ${product.product_name}`,
	);

	try {
		let usdaDetail = await lookupCachedUsdaDetail(product);
		if (usdaDetail) {
			summary.usdaCacheHits += 1;
		} else {
			usdaDetail = await fetchUsdaDetail(product);
			await sleep(REQUEST_DELAY_MS);
			if (usdaDetail) summary.usdaLiveMatches += 1;
		}

		const metadata = usdaDetail ? getUsdaMetadata(usdaDetail) : null;
		const fields = metadata ? getUsdaCandidateFields(product, metadata) : [];

		if (usdaDetail && fields.length > 0) {
			const sourceReference = String(usdaDetail.fdcId);
			const enrichedFood = applyUsdaMetadata(
				product.food,
				metadata,
				sourceReference,
				fields,
			);
			const observedAt = new Date().toISOString();
			const observations = fields.map((field) => {
				const value = getTrackedFieldValue(enrichedFood, field);
				const rawPayload = {
					field,
					value,
					sourceReference,
				};
				return {
					key: field,
					trackedField: field,
					source: "usda",
					sourceReference,
					sourceLicense: usdaPolicy.canonical_license_name,
					rawPayload,
					contentHash: createContentHash({
						barcode: product.barcode,
						source: "usda",
						sourceReference,
						rawPayload,
					}),
					observedAt,
				};
			});
			const provenance = fields.map((field) => ({
				fieldPath: field,
				observationKey: field,
				source: "usda",
				sourceReference,
				sourceValue: getTrackedFieldValue(enrichedFood, field),
				normalizedValue: getTrackedFieldValue(enrichedFood, field),
				confidence: "source-verified",
				verificationMethod: "exact-barcode",
			}));

			if (isDryRun) {
				console.log(`  would persist USDA fields: ${fields.join(", ")}`);
			} else {
				const standardFields = fields.filter(
					(field) => !SUPPLEMENTAL_ENRICHMENT_FIELDS.has(field),
				);
				const supplementalFields = fields.filter((field) =>
					SUPPLEMENTAL_ENRICHMENT_FIELDS.has(field),
				);
				const appliedFields = [];
				for (const [rpcName, rpcFields] of [
					["apply_shared_product_external_enrichment", standardFields],
					["apply_shared_product_supplemental_enrichment", supplementalFields],
				]) {
					if (rpcFields.length === 0) continue;
					const { data, error } = await supabase.rpc(rpcName, {
						p_shared_product_id: product.id,
						p_barcode: normalizeBarcode(product.barcode),
						p_enriched_food: enrichedFood,
						...(rpcName === "apply_shared_product_external_enrichment"
							? { p_category_option_id: product.category_option_id }
							: {}),
						p_candidate_fields: rpcFields,
						p_observations: observations.filter((observation) =>
							rpcFields.includes(observation.trackedField),
						),
						p_provenance: provenance.filter((entry) =>
							rpcFields.includes(entry.fieldPath),
						),
					});
					if (error) throw error;
					appliedFields.push(...(data ?? []));
				}
				if (appliedFields.length > 0) {
					summary.productsUpdated += 1;
					summary.fieldsUpdated += appliedFields.length;
					console.log(`  persisted USDA fields: ${appliedFields.join(", ")}`);
				}
			}
		} else if (!usdaDetail) {
			summary.usdaMisses += 1;
		}

		const projectedFood = metadata
			? applyUsdaMetadata(
					product.food,
					metadata,
					String(usdaDetail.fdcId),
					fields,
				)
			: product.food;
		const stillNeedsLicensedMetadata = Object.values(
			getMissingFields(
				projectedFood,
				projectedFood.brandOwner ?? product.brand_owner,
			),
		).some(Boolean);
		if (stillNeedsLicensedMetadata) {
			try {
				const offResponse = await lookupOpenFoodFacts(product.barcode);
				await sleep(REQUEST_DELAY_MS);
				const offProduct = offResponse?.product;
				const offHasMetadata = Boolean(
					offProduct?.ingredients_text_en ||
					offProduct?.ingredients_text ||
					offProduct?.ingredients?.length ||
					offProduct?.ingredients_tags?.length ||
					offProduct?.ingredients_analysis_tags?.length ||
					offProduct?.allergens ||
					offProduct?.allergens_tags?.length ||
					offProduct?.allergens_hierarchy?.length ||
					offProduct?.traces ||
					offProduct?.traces_tags?.length ||
					offProduct?.traces_hierarchy?.length ||
					offProduct?.additives_tags?.length ||
					offProduct?.labels ||
					offProduct?.labels_tags?.length ||
					offProduct?.product_quantity ||
					offProduct?.last_modified_t,
				);
				if (offHasMetadata) {
					summary.openFoodFactsMetadataCached += 1;
					console.log(
						"  Open Food Facts metadata is available in the licensed provider cache.",
					);
				}
			} catch (error) {
				summary.providerWarnings += 1;
				console.warn(
					`  secondary Open Food Facts lookup skipped: ${formatError(error)}`,
				);
			}
		}
	} catch (error) {
		summary.errors += 1;
		console.error(`  failed: ${formatError(error)}`);
	}
}

console.log(
	JSON.stringify({ dryRun: isDryRun, cachedOnly, ...summary }, null, 2),
);
if (summary.errors > 0) process.exitCode = 1;
