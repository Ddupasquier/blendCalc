/**
 * Purpose: Run a read-only, source-specific barcode audit against USDA FoodData
 * Central, Open Food Facts, and COLA Cloud. The script discovers real exact-GTIN
 * records, exercises each provider's barcode lookup path, validates nutrient and
 * serving math where available, classifies the manual-entry work a user would still
 * need to complete, and writes a detailed ignored JSON report.
 * Run: `node scripts/audits/food-sources/audit_barcode_provider_experience.mjs --sample-size=50`
 * Faster smoke run: `node scripts/audits/food-sources/audit_barcode_provider_experience.mjs --sample-size=5`
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	getBarcodeLookupCandidates,
	normalizeBarcode,
} from "../../lib/barcode/barcode_candidates.mjs";
import { createAppUserAgent } from "../../lib/releases/app_version.mjs";
import {
	auditNutrientRelationships,
	auditOpenFoodFactsServingBasis,
	auditPer100ServingRoundTrip,
	auditUsdaLabelConsistency,
	canonicalizeUsdaNutrients,
	createNutrientMap,
	getOpenFoodFactsServingWeightGrams,
	getSourceServingWeightGrams,
	mapOpenFoodFactsPer100Nutrients,
} from "../../lib/barcode/barcodeNutritionAudit.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const APP_USER_AGENT = createAppUserAgent("barcode provider experience audit");
const DEFAULT_SAMPLE_SIZE = 50;
const MAX_SAMPLE_SIZE = 100;
const USDA_LIST_PAGE_SIZE = 200;
const USDA_SEARCH_PAGE_SIZE = 50;
const OPEN_FOOD_FACTS_DISCOVERY_PAGE_SIZE = 100;
const COLA_CLOUD_LIST_PAGE_SIZE = 100;
const OPEN_FOOD_FACTS_DELAY_MILLISECONDS = 700;
const COLA_CLOUD_DELAY_MILLISECONDS = 120;
const REQUEST_TIMEOUT_MILLISECONDS = 15_000;

const parsePositiveIntegerArgument = (name, fallback) => {
	const argument = process.argv.find((value) => value.startsWith(`--${name}=`));
	if (!argument) return fallback;
	const value = Number.parseInt(argument.split("=")[1], 10);
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new TypeError(`--${name} must be a positive integer.`);
	}
	return value;
};

const sampleSize = Math.min(
	parsePositiveIntegerArgument("sample-size", DEFAULT_SAMPLE_SIZE),
	MAX_SAMPLE_SIZE,
);
const reportArgument = process.argv.find((value) =>
	value.startsWith("--report="),
);
const reportPath = reportArgument
	? path.resolve(reportArgument.slice("--report=".length))
	: path.resolve(
			"scripts/output",
			`barcode-provider-experience-${new Date().toISOString().replaceAll(":", "-")}.json`,
		);

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const usdaApiKey = process.env.FDC_API_KEY;
const colaCloudApiKey = process.env.COLA_CLOUD_API_KEY;
if (!supabaseUrl || !serviceRoleKey || !usdaApiKey || !colaCloudApiKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FDC_API_KEY, and COLA_CLOUD_API_KEY are required.",
	);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: { transport: WebSocket },
});

const sleep = (milliseconds) =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});

const trace = {
	usda: { requests: 0, retries: 0, errors: 0 },
	"open-food-facts": { requests: 0, retries: 0, errors: 0 },
	"cola-cloud": { requests: 0, retries: 0, errors: 0 },
};

const fetchWithRetry = async (
	url,
	options,
	{ source, allowNotFound = false } = {},
) => {
	const sourceTrace = trace[source];
	const retryableStatuses = new Set([429, 500, 502, 503, 504]);
	for (let attempt = 0; attempt < 5; attempt += 1) {
		sourceTrace.requests += 1;
		let response;
		try {
			response = await fetch(url, {
				...options,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
			});
		} catch (error) {
			sourceTrace.errors += 1;
			if (attempt === 4) throw error;
			sourceTrace.retries += 1;
			await sleep(500 * 2 ** attempt);
			continue;
		}
		if (response.ok || (allowNotFound && response.status === 404)) {
			return response;
		}
		sourceTrace.errors += 1;
		if (!retryableStatuses.has(response.status) || attempt === 4) {
			throw new Error(`${url} returned ${response.status}.`);
		}
		sourceTrace.retries += 1;
		const retryAfterSeconds = Number(response.headers.get("retry-after"));
		await sleep(
			Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
				? retryAfterSeconds * 1000
				: 500 * 2 ** attempt,
		);
	}
	throw new Error(`Unable to fetch ${url}.`);
};

const queryAll = async (table, columns, configureQuery) => {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		let query = supabase
			.from(table)
			.select(columns)
			.range(from, from + 999);
		if (configureQuery) query = configureQuery(query);
		const { data, error } = await query;
		if (error) throw error;
		rows.push(...data);
		if (data.length < 1000) return rows;
	}
};

const loadReferenceData = async () => {
	const [
		definitions,
		mappings,
		conversions,
		equivalences,
		profiles,
		requirements,
	] = await Promise.all([
		queryAll(
			"nutrient_definitions",
			"nutrient_id,nutrient_name,nutrient_number,default_unit_name",
		),
		queryAll(
			"nutrient_source_mappings",
			"source_key,source_nutrient_key,source_unit_name,source_nutrient_name,nutrient_id,priority,review_status,enabled",
		),
		queryAll(
			"nutrient_unit_conversions",
			"source_key,nutrient_id,from_unit_name,to_unit_name,multiplier",
		),
		queryAll(
			"nutrient_equivalences",
			"source_key,source_nutrient_id,canonical_nutrient_id,enabled",
			(query) => query.eq("enabled", true),
		),
		queryAll(
			"nutrition_completeness_profiles",
			"key,food_scope,region_code,is_default,enabled",
			(query) => query.eq("enabled", true),
		),
		queryAll(
			"nutrition_completeness_profile_nutrients",
			"profile_key,nutrient_id,requirement_level",
		),
	]);
	const definitionsById = new Map(
		definitions.map((definition) => [
			Number(definition.nutrient_id),
			definition,
		]),
	);
	const enrichedMappings = mappings.map((mapping) => {
		const definition = definitionsById.get(Number(mapping.nutrient_id));
		return {
			...mapping,
			nutrient_name: definition?.nutrient_name ?? mapping.source_nutrient_name,
			nutrient_number: definition?.nutrient_number ?? "",
			default_unit_name:
				definition?.default_unit_name ?? mapping.source_unit_name,
		};
	});
	const packagedProfile =
		profiles.find(
			(profile) =>
				profile.food_scope === "packaged" &&
				profile.region_code === "US" &&
				profile.is_default,
		) ??
		profiles.find(
			(profile) => profile.food_scope === "packaged" && profile.is_default,
		);
	const requiredPackagedNutrientIds = new Set(
		requirements
			.filter(
				(requirement) =>
					requirement.profile_key === packagedProfile?.key &&
					requirement.requirement_level === "required",
			)
			.map((requirement) => Number(requirement.nutrient_id)),
	);
	return {
		definitions,
		mappings: enrichedMappings,
		conversions,
		equivalences,
		requiredPackagedNutrientIds,
		packagedProfileKey: packagedProfile?.key ?? null,
	};
};

const hasText = (value) => Boolean(String(value ?? "").trim());
const toNonnegativeNumber = (value) => {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : null;
};
const sourceDate = (value) => Date.parse(value ?? "") || 0;

const getMissingRequiredNutrientIds = (nutrientMap, requiredIds) =>
	[...requiredIds].filter(
		(nutrientId) =>
			![...nutrientMap.values()].some(
				(nutrient) => nutrient.nutrientId === nutrientId,
			),
	);

const classifyManualEntryExperience = ({
	hasName,
	hasBrand,
	hasCategory,
	hasServing,
	hasIngredients,
	hasAllergenData,
	hasImage,
	hasAlcoholByVolume,
	nutrientCount,
	missingRequiredNutrientCount,
}) => {
	const experience = hasAlcoholByVolume
		? "sparse-alcohol-review"
		: nutrientCount === 0
			? "identity-only-manual-entry"
			: missingRequiredNutrientCount === 0 && hasServing
				? "standard-autofill"
				: "partial-autofill";
	return {
		experience,
		requiresNameEntry: !hasName,
		requiresBrandReview: !hasBrand,
		requiresCategorySelection: !hasCategory,
		requiresServingEntry: !hasAlcoholByVolume && !hasServing,
		requiresNutrientEntry:
			!hasAlcoholByVolume && missingRequiredNutrientCount > 0,
		requiresDisclosureConfirmation: hasAlcoholByVolume,
		requiresLabelEvidenceForIngredientsOrAllergens:
			!hasIngredients || !hasAllergenData,
		hasReusableImage: hasImage,
	};
};

const createCoverage = ({
	hasName,
	hasBrand,
	hasCategory,
	hasServing,
	hasIngredients,
	hasAllergenData,
	hasImage,
	hasAlcoholByVolume,
	nutrientMap,
	requiredNutrientIds,
}) => {
	const missingRequiredNutrientIds = getMissingRequiredNutrientIds(
		nutrientMap,
		requiredNutrientIds,
	);
	const reportedZeroNutrientCount = [...nutrientMap.values()].filter(
		(nutrient) => nutrient.value === 0,
	).length;
	return {
		hasName,
		hasBrand,
		hasCategory,
		hasServing,
		hasIngredients,
		hasAllergenData,
		hasImage,
		hasAlcoholByVolume,
		nutrientCount: nutrientMap.size,
		reportedZeroNutrientCount,
		missingRequiredNutrientIds,
		manualEntry: classifyManualEntryExperience({
			hasName,
			hasBrand,
			hasCategory,
			hasServing,
			hasIngredients,
			hasAllergenData,
			hasImage,
			hasAlcoholByVolume,
			nutrientCount: nutrientMap.size,
			missingRequiredNutrientCount: missingRequiredNutrientIds.length,
		}),
	};
};

const discoverUsdaBarcodes = async () => {
	const targets = new Map();
	let pageNumber = 1;
	while (targets.size < sampleSize) {
		const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/list");
		url.searchParams.set("api_key", usdaApiKey);
		const response = await fetchWithRetry(
			url,
			{
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					dataType: ["Branded"],
					pageSize: USDA_LIST_PAGE_SIZE,
					pageNumber,
					sortBy: "fdcId",
					sortOrder: "desc",
				}),
			},
			{ source: "usda" },
		);
		const foods = await response.json();
		if (!Array.isArray(foods) || foods.length === 0) break;
		for (const food of foods) {
			const barcode = normalizeBarcode(food.gtinUpc);
			if (!barcode || food.dataType !== "Branded") continue;
			targets.set(barcode, { barcode, discoveryFdcId: Number(food.fdcId) });
			if (targets.size >= sampleSize) break;
		}
		pageNumber += 1;
	}
	if (targets.size < sampleSize) {
		throw new Error(`USDA supplied only ${targets.size} usable exact GTINs.`);
	}
	return [...targets.values()];
};

const selectNewestUsdaExactMatch = (foods, canonicalBarcode) =>
	(foods ?? [])
		.filter(
			(food) =>
				food.dataType === "Branded" &&
				normalizeBarcode(food.gtinUpc) === canonicalBarcode,
		)
		.sort((left, right) => {
			const activeDifference =
				Number(Boolean(left.discontinuedDate)) -
				Number(Boolean(right.discontinuedDate));
			return (
				activeDifference ||
				sourceDate(
					right.publishedDate ?? right.publicationDate ?? right.modifiedDate,
				) -
					sourceDate(
						left.publishedDate ?? left.publicationDate ?? left.modifiedDate,
					) ||
				Number(right.fdcId) - Number(left.fdcId)
			);
		})[0] ?? null;

const lookupUsdaProduct = async (target, referenceData) => {
	const startedAt = Date.now();
	let match = null;
	for (const candidate of getBarcodeLookupCandidates(target.barcode)) {
		const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
		url.searchParams.set("api_key", usdaApiKey);
		url.searchParams.set("query", candidate);
		url.searchParams.set("dataType", "Branded");
		url.searchParams.set("pageSize", String(USDA_SEARCH_PAGE_SIZE));
		const response = await fetchWithRetry(
			url,
			{
				headers: { accept: "application/json" },
			},
			{ source: "usda" },
		);
		const payload = await response.json();
		match = selectNewestUsdaExactMatch(payload.foods, target.barcode);
		if (match) break;
	}
	if (!match) {
		return {
			barcode: target.barcode,
			outcome: "not-found",
			durationMilliseconds: Date.now() - startedAt,
		};
	}
	const detailUrl = new URL(
		`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(match.fdcId)}`,
	);
	detailUrl.searchParams.set("api_key", usdaApiKey);
	const detailResponse = await fetchWithRetry(
		detailUrl,
		{
			headers: { accept: "application/json" },
		},
		{ source: "usda" },
	);
	const food = await detailResponse.json();
	const nutrients = canonicalizeUsdaNutrients(food, referenceData);
	const { nutrientMap, duplicates } = createNutrientMap(nutrients);
	const servingWeightGrams = getSourceServingWeightGrams(food);
	const roundTrip = auditPer100ServingRoundTrip(
		nutrients,
		servingWeightGrams ?? 100,
	);
	const labelConsistency = auditUsdaLabelConsistency(food, nutrientMap);
	const relationshipIssues = auditNutrientRelationships(nutrientMap);
	const coverage = createCoverage({
		hasName: hasText(food.description),
		hasBrand: hasText(food.brandOwner ?? food.brandName),
		hasCategory: hasText(food.brandedFoodCategory ?? food.foodCategory),
		hasServing: servingWeightGrams !== null,
		hasIngredients: hasText(food.ingredients),
		hasAllergenData: false,
		hasImage: Boolean(food.image?.imageUrl),
		hasAlcoholByVolume: false,
		nutrientMap,
		requiredNutrientIds: referenceData.requiredPackagedNutrientIds,
	});
	return {
		barcode: target.barcode,
		outcome: "matched",
		durationMilliseconds: Date.now() - startedAt,
		sourceReference: String(food.fdcId),
		productName: food.description ?? null,
		coverage,
		math: {
			duplicateCanonicalNutrients: duplicates,
			roundTripChecks: roundTrip.checked,
			roundTripMismatches: roundTrip.mismatched,
			labelChecks: labelConsistency.checked,
			labelMismatches: labelConsistency.mismatched,
			labelNutrientsMissingPer100: labelConsistency.missingPer100,
			nutrientRelationshipIssues: relationshipIssues,
		},
	};
};

const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"generic_name",
	"brands",
	"ingredients_text",
	"ingredients_text_en",
	"allergens",
	"allergens_tags",
	"traces",
	"traces_tags",
	"categories",
	"categories_tags",
	"image_front_url",
	"image_url",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"quantity",
	"product_quantity",
	"product_quantity_unit",
	"nutriments",
].join(",");

const discoverOpenFoodFactsBarcodes = async () => {
	const targets = new Map();
	let page = 1;
	while (targets.size < sampleSize) {
		const url = new URL("https://world.openfoodfacts.org/api/v2/search");
		url.searchParams.set("page", String(page));
		url.searchParams.set(
			"page_size",
			String(OPEN_FOOD_FACTS_DISCOVERY_PAGE_SIZE),
		);
		url.searchParams.set("fields", "code,product_name");
		const response = await fetchWithRetry(
			url,
			{
				headers: { accept: "application/json", "user-agent": APP_USER_AGENT },
			},
			{ source: "open-food-facts" },
		);
		const payload = await response.json();
		for (const product of payload.products ?? []) {
			const barcode = normalizeBarcode(product.code);
			if (!barcode || !hasText(product.product_name)) continue;
			targets.set(barcode, { barcode });
			if (targets.size >= sampleSize) break;
		}
		if (!payload.products?.length) break;
		page += 1;
		if (targets.size < sampleSize) await sleep(6_200);
	}
	if (targets.size < sampleSize) {
		throw new Error(
			`Open Food Facts supplied only ${targets.size} usable exact GTINs.`,
		);
	}
	return [...targets.values()];
};

const lookupOpenFoodFactsProduct = async (target, referenceData) => {
	const startedAt = Date.now();
	let product = null;
	for (const candidate of getBarcodeLookupCandidates(target.barcode)) {
		const url = new URL(
			`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json`,
		);
		url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
		const response = await fetchWithRetry(
			url,
			{
				headers: { accept: "application/json", "user-agent": APP_USER_AGENT },
			},
			{ source: "open-food-facts", allowNotFound: true },
		);
		if (response.status === 404) continue;
		const payload = await response.json();
		if (
			payload.status === 1 &&
			payload.product &&
			normalizeBarcode(payload.product.code ?? candidate) === target.barcode
		) {
			product = payload.product;
			break;
		}
	}
	if (!product) {
		return {
			barcode: target.barcode,
			outcome: "not-found",
			durationMilliseconds: Date.now() - startedAt,
		};
	}
	const nutrients = mapOpenFoodFactsPer100Nutrients(product, referenceData);
	const { nutrientMap, duplicates } = createNutrientMap(nutrients);
	const servingWeightGrams = getOpenFoodFactsServingWeightGrams(product);
	const servingBasis = auditOpenFoodFactsServingBasis(product, referenceData);
	const roundTrip = auditPer100ServingRoundTrip(
		nutrients,
		servingWeightGrams ?? 100,
	);
	const relationshipIssues = auditNutrientRelationships(nutrientMap);
	const alcoholPercent = toNonnegativeNumber(
		product.nutriments?.alcohol_100g ??
			product.nutriments?.alcohol_value ??
			product.nutriments?.alcohol,
	);
	const alcoholUnit = String(product.nutriments?.alcohol_unit ?? "")
		.trim()
		.toLocaleLowerCase()
		.replaceAll(" ", "");
	const hasAlcoholByVolume =
		alcoholPercent !== null &&
		alcoholPercent <= 100 &&
		["%vol", "%alc/vol"].includes(alcoholUnit);
	const coverage = createCoverage({
		hasName: hasText(product.product_name ?? product.generic_name),
		hasBrand: hasText(product.brands),
		hasCategory:
			hasText(product.categories) || product.categories_tags?.length > 0,
		hasServing: servingWeightGrams !== null,
		hasIngredients: hasText(
			product.ingredients_text_en ?? product.ingredients_text,
		),
		hasAllergenData:
			hasText(product.allergens) ||
			product.allergens_tags?.length > 0 ||
			hasText(product.traces) ||
			product.traces_tags?.length > 0,
		hasImage: hasText(product.image_front_url ?? product.image_url),
		hasAlcoholByVolume,
		nutrientMap,
		requiredNutrientIds: referenceData.requiredPackagedNutrientIds,
	});
	return {
		barcode: target.barcode,
		outcome: "matched",
		durationMilliseconds: Date.now() - startedAt,
		sourceReference: target.barcode,
		productName: product.product_name ?? product.generic_name ?? null,
		coverage,
		math: {
			duplicateCanonicalNutrients: duplicates,
			servingBasisChecks: servingBasis.checked,
			servingBasisMismatches: servingBasis.mismatched,
			roundTripChecks: roundTrip.checked,
			roundTripMismatches: roundTrip.mismatched,
			nutrientRelationshipIssues: relationshipIssues,
		},
	};
};

const colaCloudHeaders = {
	accept: "application/json",
	"x-api-key": colaCloudApiKey,
};

const fetchColaCloudData = async (pathValue, allowNotFound = false) => {
	const response = await fetchWithRetry(
		`https://app.colacloud.us/api/v1${pathValue}`,
		{ headers: colaCloudHeaders },
		{ source: "cola-cloud", allowNotFound },
	);
	if (response.status === 404) return null;
	const payload = await response.json();
	return payload.data ?? null;
};

const getDetailBarcodes = (detail) =>
	[
		detail?.barcode_value,
		...(detail?.barcodes ?? []).map((barcode) => barcode.barcode_value),
	].flatMap((value) => {
		const barcode = normalizeBarcode(value);
		return barcode ? [barcode] : [];
	});

const discoverColaCloudBarcodes = async () => {
	const targets = new Map();
	let page = 1;
	while (targets.size < sampleSize) {
		const query = new URLSearchParams({
			status: "approved",
			page: String(page),
			per_page: String(COLA_CLOUD_LIST_PAGE_SIZE),
		});
		const records = await fetchColaCloudData(`/colas?${query}`);
		if (!Array.isArray(records) || records.length === 0) break;
		for (const record of records) {
			if (!record.has_barcode || !record.ttb_id) continue;
			const detail = await fetchColaCloudData(
				`/colas/${encodeURIComponent(record.ttb_id)}`,
			);
			for (const barcode of getDetailBarcodes(detail)) {
				if (!targets.has(barcode)) {
					targets.set(barcode, { barcode, discoveryDetail: detail });
				}
				if (targets.size >= sampleSize) break;
			}
			if (targets.size >= sampleSize) break;
			await sleep(COLA_CLOUD_DELAY_MILLISECONDS);
		}
		page += 1;
	}
	if (targets.size < sampleSize) {
		throw new Error(
			`COLA Cloud supplied only ${targets.size} usable exact GTINs.`,
		);
	}
	return [...targets.values()];
};

const selectNewestApprovedCola = (records) =>
	(records ?? [])
		.filter(
			(record) =>
				hasText(record.ttb_id) &&
				String(record.application_status ?? "")
					.trim()
					.toLocaleLowerCase() === "approved",
		)
		.sort(
			(left, right) =>
				sourceDate(right.approval_date) - sourceDate(left.approval_date) ||
				String(right.ttb_id).localeCompare(String(left.ttb_id)),
		)[0] ?? null;

const lookupColaCloudProduct = async (target) => {
	const startedAt = Date.now();
	let approval = null;
	for (const candidate of getBarcodeLookupCandidates(target.barcode)) {
		const lookup = await fetchColaCloudData(
			`/barcode/${encodeURIComponent(candidate)}`,
			true,
		);
		if (!lookup || normalizeBarcode(lookup.barcode_value) !== target.barcode) {
			continue;
		}
		approval = selectNewestApprovedCola(lookup.colas);
		if (approval) break;
	}
	if (!approval) {
		return {
			barcode: target.barcode,
			outcome: "not-found",
			durationMilliseconds: Date.now() - startedAt,
		};
	}
	const detail =
		target.discoveryDetail?.ttb_id === approval.ttb_id
			? target.discoveryDetail
			: await fetchColaCloudData(
					`/colas/${encodeURIComponent(approval.ttb_id)}`,
				);
	if (!detail || !getDetailBarcodes(detail).includes(target.barcode)) {
		return {
			barcode: target.barcode,
			outcome: "identity-mismatch",
			durationMilliseconds: Date.now() - startedAt,
			sourceReference: approval.ttb_id ?? null,
		};
	}
	const alcoholPercent = toNonnegativeNumber(detail.abv);
	const validAlcoholByVolume = alcoholPercent !== null && alcoholPercent <= 100;
	const volume = toNonnegativeNumber(detail.volume);
	const validPackageQuantity =
		volume !== null && volume > 0 && hasText(detail.volume_unit);
	const nutrientMap = new Map();
	const coverage = createCoverage({
		hasName: hasText(detail.product_name),
		hasBrand: hasText(detail.brand_name),
		hasCategory: false,
		hasServing: false,
		hasIngredients: false,
		hasAllergenData: false,
		hasImage: false,
		hasAlcoholByVolume: validAlcoholByVolume,
		nutrientMap,
		requiredNutrientIds: new Set(),
	});
	return {
		barcode: target.barcode,
		outcome: "matched",
		durationMilliseconds: Date.now() - startedAt,
		sourceReference: String(detail.ttb_id),
		productName: detail.product_name ?? null,
		coverage,
		alcohol: {
			percent: alcoholPercent,
			validAlcoholByVolume,
			packageAmount: volume,
			packageUnit: detail.volume_unit ?? null,
			validPackageQuantity,
			productType: detail.product_type ?? null,
		},
		math: {
			invalidAlcoholByVolume: alcoholPercent !== null && !validAlcoholByVolume,
			invalidPackageQuantity:
				(detail.volume !== null || detail.volume_unit) && !validPackageQuantity,
		},
	};
};

const runProviderAudit = async ({
	source,
	targets,
	lookup,
	delayMilliseconds = 0,
}) => {
	const results = [];
	for (const [index, target] of targets.entries()) {
		try {
			results.push(await lookup(target));
		} catch (error) {
			results.push({
				barcode: target.barcode,
				outcome: "error",
				error: error instanceof Error ? error.message : String(error),
			});
		}
		console.log(
			`${source}: ${index + 1}/${targets.length} ${results.at(-1).outcome}`,
		);
		if (index + 1 < targets.length && delayMilliseconds > 0) {
			await sleep(delayMilliseconds);
		}
	}
	return results;
};

const quantile = (values, percentile) => {
	const sorted = values
		.filter(Number.isFinite)
		.sort((left, right) => left - right);
	if (sorted.length === 0) return null;
	const index = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil(sorted.length * percentile) - 1),
	);
	return sorted[index];
};

const flattenMathIssues = (result) => {
	if (!result.math) return [];
	return Object.entries(result.math).flatMap(([key, value]) => {
		if (Array.isArray(value))
			return value.map((details) => ({ type: key, details }));
		return value === true ? [{ type: key }] : [];
	});
};

const summarizeProvider = (source, results) => {
	const matched = results.filter((result) => result.outcome === "matched");
	const durations = matched.map((result) => result.durationMilliseconds);
	const experiences = Object.groupBy(
		matched,
		(result) => result.coverage.manualEntry.experience,
	);
	return {
		source,
		lookups: results.length,
		matches: matched.length,
		notFound: results.filter((result) => result.outcome === "not-found").length,
		identityMismatches: results.filter(
			(result) => result.outcome === "identity-mismatch",
		).length,
		errors: results.filter((result) => result.outcome === "error").length,
		medianMilliseconds: quantile(durations, 0.5),
		p95Milliseconds: quantile(durations, 0.95),
		averageNutrientCount: matched.length
			? Number(
					(
						matched.reduce(
							(total, result) => total + result.coverage.nutrientCount,
							0,
						) / matched.length
					).toFixed(1),
				)
			: 0,
		fieldCoverage: Object.fromEntries(
			[
				"hasBrand",
				"hasCategory",
				"hasServing",
				"hasIngredients",
				"hasAllergenData",
				"hasImage",
				"hasAlcoholByVolume",
			].map((field) => [
				field,
				matched.filter((result) => result.coverage[field]).length,
			]),
		),
		manualEntryExperiences: Object.fromEntries(
			Object.entries(experiences).map(([key, entries]) => [
				key,
				entries.length,
			]),
		),
		mathIssueCount: matched.reduce(
			(total, result) => total + flattenMathIssues(result).length,
			0,
		),
	};
};

const loadCatalogSummary = async () => {
	const [products, nutrients, servings, provenance] = await Promise.all([
		queryAll(
			"shared_products",
			"id,barcode,product_name,brand_owner,status,last_verified_at",
			(query) => query.eq("status", "active"),
		),
		queryAll(
			"food_nutrients",
			"shared_product_id,nutrient_id,amount_per_100g,value_origin",
		),
		queryAll("food_servings", "shared_product_id,is_primary,gram_weight"),
		queryAll(
			"shared_product_field_provenance",
			"shared_product_id,field_path,selected",
			(query) => query.eq("selected", true),
		),
	]);
	const nutrientProductIds = new Set(
		nutrients.map((row) => row.shared_product_id),
	);
	const primaryServingProductIds = new Set(
		servings
			.filter((row) => row.is_primary)
			.map((row) => row.shared_product_id),
	);
	const provenanceProductIds = new Set(
		provenance.map((row) => row.shared_product_id),
	);
	return {
		activeProducts: products.length,
		productsWithBrand: products.filter((product) =>
			hasText(product.brand_owner),
		).length,
		productsWithNutrients: products.filter((product) =>
			nutrientProductIds.has(product.id),
		).length,
		productsWithPrimaryServing: products.filter((product) =>
			primaryServingProductIds.has(product.id),
		).length,
		productsWithSelectedProvenance: products.filter((product) =>
			provenanceProductIds.has(product.id),
		).length,
		productsWithoutVerificationDate: products
			.filter((product) => !product.last_verified_at)
			.map((product) => ({
				barcode: product.barcode,
				productName: product.product_name,
			})),
	};
};

console.log(
	`Discovering ${sampleSize} real exact-GTIN records per live barcode provider...`,
);
const referenceData = await loadReferenceData();
const [usdaTargets, openFoodFactsTargets, colaCloudTargets, catalogSummary] =
	await Promise.all([
		discoverUsdaBarcodes(),
		discoverOpenFoodFactsBarcodes(),
		discoverColaCloudBarcodes(),
		loadCatalogSummary(),
	]);

console.log("Running USDA exact-barcode and math checks...");
const usdaResults = await runProviderAudit({
	source: "USDA",
	targets: usdaTargets,
	lookup: (target) => lookupUsdaProduct(target, referenceData),
});

console.log("Running Open Food Facts exact-barcode and math checks...");
const openFoodFactsResults = await runProviderAudit({
	source: "Open Food Facts",
	targets: openFoodFactsTargets,
	lookup: (target) => lookupOpenFoodFactsProduct(target, referenceData),
	delayMilliseconds: OPEN_FOOD_FACTS_DELAY_MILLISECONDS,
});

console.log("Running COLA Cloud exact-barcode and disclosure checks...");
const colaCloudResults = await runProviderAudit({
	source: "COLA Cloud",
	targets: colaCloudTargets,
	lookup: lookupColaCloudProduct,
	delayMilliseconds: COLA_CLOUD_DELAY_MILLISECONDS,
});

const summaries = [
	summarizeProvider("usda", usdaResults),
	summarizeProvider("open-food-facts", openFoodFactsResults),
	summarizeProvider("cola-cloud", colaCloudResults),
];
const report = {
	generatedAt: new Date().toISOString(),
	sampleSizePerProvider: sampleSize,
	packagedNutritionProfileKey: referenceData.packagedProfileKey,
	requiredPackagedNutrientIds: [
		...referenceData.requiredPackagedNutrientIds,
	].sort((left, right) => left - right),
	requestTrace: trace,
	providerSummaries: summaries,
	sharedCatalogSummary: catalogSummary,
	results: {
		usda: usdaResults,
		"open-food-facts": openFoodFactsResults,
		"cola-cloud": colaCloudResults,
	},
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.table(
	summaries.map((summary) => ({
		Source: summary.source,
		Lookups: summary.lookups,
		Matches: summary.matches,
		Errors: summary.errors,
		"Identity mismatches": summary.identityMismatches,
		"Median ms": summary.medianMilliseconds,
		"P95 ms": summary.p95Milliseconds,
		"Avg nutrients": summary.averageNutrientCount,
		"Math issues": summary.mathIssueCount,
	})),
);
console.log("Shared catalog:", catalogSummary);
console.log(`Detailed report: ${reportPath}`);

if (
	summaries.some(
		(summary) =>
			summary.errors > 0 ||
			summary.identityMismatches > 0 ||
			summary.mathIssueCount > 0,
	)
) {
	process.exitCode = 1;
}
