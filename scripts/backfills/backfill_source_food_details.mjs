/**
 * Purpose: Enrich existing saved ingredient snapshots from exact USDA identifiers or
 * exact GTIN matches. The script adds source-detail nutrients, ingredient statements,
 * and legitimate gram-weight portions without fuzzy matching, replacing missing values
 * with zero, or changing user-owned names/categories. Requests use the shared Supabase
 * provider cache shape and bounded retries. Review the dry run before writing.
 * Preview: `node scripts/backfills/backfill_source_food_details.mjs --dry-run`
 * Execute: `node scripts/backfills/backfill_source_food_details.mjs`
 * Limit: `node scripts/backfills/backfill_source_food_details.mjs --dry-run --limit=10`
 */

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	findFirstBarcodeCandidateMatch,
	normalizeBarcode,
} from "../lib/barcode_candidates.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const isDryRun = process.argv.includes("--dry-run");
const limitArgument = process.argv.find((argument) =>
	argument.startsWith("--limit=")
);
const limit = limitArgument
	? Number.parseInt(limitArgument.split("=")[1] ?? "", 10)
	: null;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fdcApiKey =
	process.env.FDC_API_KEY?.trim() || process.env.VITE_FDC_API_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey || !fdcApiKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FDC_API_KEY or VITE_FDC_API_KEY are required.",
	);
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

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const CACHE_TTL_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;
const CACHE_STALE_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;
const REQUEST_DELAY_MILLISECONDS = 200;
const REQUEST_TIMEOUT_MILLISECONDS = 12_000;
const RETRY_DELAYS_MILLISECONDS = [750, 2_000, 5_000];
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const PAGE_SIZE = 1_000;

const sleep = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const toCacheKey = (requestKind, cacheValue) =>
	createHash("sha256")
		.update(JSON.stringify({ kind: requestKind, value: cacheValue }))
		.digest("hex");

const readCache = async (requestKind, cacheValue) => {
	const { data, error } = await supabase
		.from("product_api_cache")
		.select("response, expires_at")
		.eq("provider", "usda")
		.eq("cache_key", toCacheKey(requestKind, cacheValue))
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	const expiresAt = Date.parse(data.expires_at);
	if (
		Number.isFinite(expiresAt) &&
		expiresAt + CACHE_STALE_MILLISECONDS < Date.now()
	) {
		return null;
	}
	return data.response;
};

const writeCache = async (requestKind, cacheValue, response) => {
	if (isDryRun) return;
	const fetchedAt = new Date();
	const { error } = await supabase.from("product_api_cache").upsert({
		provider: "usda",
		cache_key: toCacheKey(requestKind, cacheValue),
		request_kind: requestKind,
		status_code: 200,
		response,
		fetched_at: fetchedAt.toISOString(),
		expires_at: new Date(
			fetchedAt.getTime() + CACHE_TTL_MILLISECONDS,
		).toISOString(),
		etag: null,
	});
	if (error) throw error;
};

const fetchJson = async (url, label) => {
	let lastError;
	for (
		let attempt = 0;
		attempt <= RETRY_DELAYS_MILLISECONDS.length;
		attempt += 1
	) {
		try {
			const response = await fetch(url, {
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
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
		if (attempt < RETRY_DELAYS_MILLISECONDS.length) {
			await sleep(RETRY_DELAYS_MILLISECONDS[attempt]);
		}
	}
	throw new Error(
		`${label} failed after bounded retries: ${lastError?.message ?? lastError}`,
	);
};

const getUsdaDetail = async (fdcId) => {
	const cacheValue = { fdcId };
	const cached = await readCache("food-detail", cacheValue);
	if (cached) return cached;
	const url = new URL(`${USDA_BASE_URL}/food/${fdcId}`);
	url.searchParams.set("api_key", fdcApiKey);
	const detail = await fetchJson(url, `USDA detail ${fdcId}`);
	if (detail) await writeCache("food-detail", cacheValue, detail);
	await sleep(REQUEST_DELAY_MILLISECONDS);
	return detail;
};

const getUsdaDetailByBarcode = async (barcode) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;
	const match = await findFirstBarcodeCandidateMatch(
		barcode,
		async (candidate) => {
			const cacheValue = {
				query: candidate,
				dataType: "Branded",
				pageSize: 50,
			};
			let search = await readCache("barcode-search", cacheValue);
			if (!search) {
				const url = new URL(`${USDA_BASE_URL}/foods/search`);
				url.searchParams.set("api_key", fdcApiKey);
				url.searchParams.set("query", candidate);
				url.searchParams.set("dataType", "Branded");
				url.searchParams.set("pageSize", "50");
				search = await fetchJson(url, `USDA barcode search ${candidate}`);
				if (search) await writeCache("barcode-search", cacheValue, search);
				await sleep(REQUEST_DELAY_MILLISECONDS);
			}
			const exact = (search?.foods ?? []).find(
				(food) => normalizeBarcode(food.gtinUpc) === canonicalBarcode,
			);
			return exact?.fdcId ? { fdcId: exact.fdcId } : null;
		},
	);
	if (!match) return null;
	const detail = await getUsdaDetail(Number(match.value.fdcId));
	return normalizeBarcode(detail?.gtinUpc) === canonicalBarcode ? detail : null;
};

const fetchAllRows = async (table, columns) => {
	const rows = [];
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await supabase
			.from(table)
			.select(columns)
			.range(from, from + PAGE_SIZE - 1);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < PAGE_SIZE) return rows;
	}
};

const toPositiveNumber = (value) => {
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
};

const normalizeNutrients = (detail) =>
	(detail?.foodNutrients ?? []).flatMap((entry) => {
		const nutrient = entry?.nutrient ?? entry;
		const nutrientId = Number(nutrient?.id ?? entry?.nutrientId);
		const value = Number(entry?.amount ?? entry?.value);
		const nutrientName = String(
			nutrient?.name ?? entry?.nutrientName ?? "",
		).trim();
		const unitName = String(
			nutrient?.unitName ?? entry?.unitName ?? "",
		).trim();
		if (
			!Number.isSafeInteger(nutrientId) ||
			nutrientId <= 0 ||
			!Number.isFinite(value) ||
			value < 0 ||
			!nutrientName ||
			!unitName
		) {
			return [];
		}
		return [{
			nutrientId,
			nutrientName,
			nutrientNumber: String(
				nutrient?.number ?? entry?.nutrientNumber ?? "",
			),
			unitName,
			value,
			valueOrigin: "reported",
			source: "usda",
			sourceReference: String(detail.fdcId),
			confidence: "source-verified",
		}];
	});

const getPortionLabel = (portion) =>
	String(
		portion?.portionDescription ||
			portion?.modifier ||
			[
				toPositiveNumber(portion?.amount),
				portion?.measureUnit?.abbreviation || portion?.measureUnit?.name,
			].filter(Boolean).join(" "),
	).trim();

const normalizeServings = (detail) => {
	const rows = (detail?.foodPortions ?? []).flatMap((portion) => {
		const label = getPortionLabel(portion);
		const gramWeight = toPositiveNumber(portion?.gramWeight);
		if (!label || gramWeight === null) return [];
		return [{
			label,
			gramWeight,
			amount: toPositiveNumber(portion?.amount) ?? undefined,
			order: toPositiveNumber(portion?.sequenceNumber),
		}];
	});
	if (rows.length === 0) {
		const gramWeight =
			String(detail?.servingSizeUnit ?? "").trim().toLocaleLowerCase() === "g"
				? toPositiveNumber(detail?.servingSize)
				: null;
		const label = String(detail?.householdServingFullText ?? "").trim();
		if (gramWeight !== null && label) {
			rows.push({ label, gramWeight, amount: undefined, order: 1 });
		}
	}
	const hasPrimary = rows.some((serving) => serving.order === 1);
	return rows.map((serving, index) => ({
		label: serving.label,
		gramWeight: serving.gramWeight,
		...(serving.amount === undefined
			? {}
			: { amount: serving.amount }),
		isPrimary: serving.order === 1 || (!hasPrimary && index === 0),
		source: "usda",
		sourceReference: String(detail.fdcId),
		confidence: "source-verified",
	}));
};

const splitIngredientList = (value) => {
	const seen = new Set();
	return String(value ?? "")
		.split(/,(?![^(]*\))/)
		.flatMap((entry) => {
			const cleaned = entry.trim();
			const key = cleaned.toLocaleLowerCase("en-US");
			if (!cleaned || seen.has(key)) return [];
			seen.add(key);
			return [cleaned];
		});
};

const mergeNutrients = (current, source) => {
	const nutrients = new Map(
		(current ?? []).map((nutrient) => [Number(nutrient.nutrientId), nutrient]),
	);
	for (const nutrient of source) {
		nutrients.set(nutrient.nutrientId, nutrient);
	}
	return [...nutrients.values()];
};

const mergeUsdaDetail = (current, detail) => {
	const sourceNutrients = normalizeNutrients(detail);
	const foodNutrients = mergeNutrients(current.foodNutrients, sourceNutrients);
	const foodServings = normalizeServings(detail);
	const ingredients = String(detail?.ingredients ?? "").trim();
	const sourceReference = String(detail.fdcId);
	return {
		...current,
		sourceIdentifiers: {
			...(current.sourceIdentifiers ?? {}),
			usdaFdcId: sourceReference,
			...(detail.ndbNumber
				? {
					usdaNdbNumber: String(detail.ndbNumber)
						.replace(/\D/g, "")
						.padStart(5, "0"),
				}
				: {}),
		},
		foodNutrients,
		reportedNutrientIds: [
			...new Set([
				...(current.reportedNutrientIds ?? []),
				...sourceNutrients.map(({ nutrientId }) => nutrientId),
			]),
		],
		...(foodServings.length > 0
			? {
				foodServings,
				hasSourceServing: true,
				customServingLabel: foodServings[0].label,
				customServingWeightGrams: foodServings[0].gramWeight,
			}
			: {}),
		...(ingredients
			? {
				ingredients,
				ingredientList: splitIngredientList(ingredients),
			}
			: {}),
		fieldProvenance: {
			...(current.fieldProvenance ?? {}),
			...(sourceNutrients.length > 0
				? {
					nutrition: {
						source: "usda",
						sourceReference,
						confidence: "source-verified",
					},
				}
				: {}),
			...(foodServings.length > 0
				? {
					serving: {
						source: "usda",
						sourceReference,
						confidence: "source-verified",
					},
				}
				: {}),
			...(ingredients
				? {
					ingredients: {
						source: "usda",
						sourceReference,
						confidence: "source-verified",
					},
				}
				: {}),
		},
	};
};

const allRows = await fetchAllRows(
	"user_food_list_items",
	"id, fdc_id, food, source_key, shared_product_id",
);
const candidates = allRows.filter((row) => {
	if (row.shared_product_id) return false;
	const food = row.food ?? {};
	const barcode = normalizeBarcode(food.barcode ?? food.gtinUpc);
	return Boolean(barcode) ||
		(
			row.source_key === "usda" &&
			Number.isSafeInteger(Number(food.fdcId ?? row.fdc_id)) &&
			Number(food.fdcId ?? row.fdc_id) > 0
		);
});
const rows = Number.isSafeInteger(limit) ? candidates.slice(0, limit) : candidates;
const summary = {
	candidates: rows.length,
	updated: 0,
	cacheOrApiMisses: 0,
	errors: 0,
	nutrientsAdded: 0,
	servingsAdded: 0,
	ingredientsAdded: 0,
};

for (const [index, row] of rows.entries()) {
	const food = row.food ?? {};
	const barcode = normalizeBarcode(food.barcode ?? food.gtinUpc);
	const fdcId = Number(food.fdcId ?? row.fdc_id);
	console.log(`[${index + 1}/${rows.length}] ${food.description ?? row.id}`);
	try {
		const detail = barcode
			? await getUsdaDetailByBarcode(barcode)
			: await getUsdaDetail(fdcId);
		if (!detail) {
			summary.cacheOrApiMisses += 1;
			console.log("  no exact USDA detail match");
			continue;
		}
		const nextFood = mergeUsdaDetail(food, detail);
		const currentNutrientCount = food.foodNutrients?.length ?? 0;
		const nextNutrientCount = nextFood.foodNutrients?.length ?? 0;
		const currentServingCount = food.foodServings?.length ?? 0;
		const nextServingCount = nextFood.foodServings?.length ?? 0;
		const addedIngredients =
			!String(food.ingredients ?? "").trim() &&
			Boolean(String(nextFood.ingredients ?? "").trim());
		const changed =
			!isDeepStrictEqual(
				food.foodNutrients ?? [],
				nextFood.foodNutrients ?? [],
			) ||
			!isDeepStrictEqual(
				food.foodServings ?? [],
				nextFood.foodServings ?? [],
			) ||
			String(food.ingredients ?? "") !==
				String(nextFood.ingredients ?? "") ||
			!isDeepStrictEqual(
				food.sourceIdentifiers ?? {},
				nextFood.sourceIdentifiers ?? {},
			);
		if (!changed) {
			console.log("  already complete for available USDA detail");
			continue;
		}
		summary.updated += 1;
		summary.nutrientsAdded += Math.max(
			nextNutrientCount - currentNutrientCount,
			0,
		);
		summary.servingsAdded += Math.max(
			nextServingCount - currentServingCount,
			0,
		);
		if (addedIngredients) summary.ingredientsAdded += 1;
		console.log(
			`  ${isDryRun ? "would add" : "added"} ` +
			`${Math.max(nextNutrientCount - currentNutrientCount, 0)} nutrients, ` +
			`${Math.max(nextServingCount - currentServingCount, 0)} servings` +
			`${addedIngredients ? ", ingredients" : ""}`,
		);
		if (isDryRun) continue;
		const { error } = await supabase
			.from("user_food_list_items")
			.update({ food: nextFood })
			.eq("id", row.id);
		if (error) throw error;
	} catch (error) {
		summary.errors += 1;
		console.error(`  failed: ${error instanceof Error ? error.message : error}`);
	}
}

console.log(JSON.stringify({ dryRun: isDryRun, ...summary }, null, 2));
if (summary.errors > 0) process.exitCode = 1;
