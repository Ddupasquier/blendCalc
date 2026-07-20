// Backfill reusable food image metadata for existing barcode-backed products.
// Usage:
//   npm run backfill:food-images -- --dry-run
//   npm run backfill:food-images
//   npm run backfill:food-images -- --limit=25

import { config } from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	findFirstBarcodeCandidateMatch,
	normalizeBarcode,
} from "./lib/barcode_candidates.mjs";
import { createAppUserAgent } from "./lib/app_version.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");
const limitArgument = process.argv.find((argument) =>
	argument.startsWith("--limit="),
);
const limit = limitArgument
	? Number.parseInt(limitArgument.split("=")[1] ?? "", 10)
	: null;

const OPEN_FOOD_FACTS_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_FOOD_FACTS_IMAGE_FIELDS = [
	"code",
	"product_name",
	"brands",
	"image_front_url",
	"image_front_small_url",
	"image_front_thumb_url",
	"image_url",
	"image_small_url",
	"image_thumb_url",
].join(",");
const OPEN_FOOD_FACTS_IMAGE_LICENSE = {
	name: "Creative Commons Attribution-ShareAlike",
	url: "https://world.openfoodfacts.org/terms-of-use",
	attribution: "Open Food Facts contributors",
};
const APP_USER_AGENT = createAppUserAgent("food image backfill");
const REQUEST_DELAY_MS = 350;
const TEMPORARY_ERROR_RETRY_DELAYS_MS = [500, 1500, 3000];
const RATE_LIMIT_RETRY_DELAYS_MS = [5000, 15000, 30000];
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const SUPABASE_PAGE_SIZE = 1000;

const sleep = (milliseconds) =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});

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
		const { data, error } = await buildQuery()
			.range(from, from + SUPABASE_PAGE_SIZE - 1);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < SUPABASE_PAGE_SIZE) break;
	}
	return rows;
};

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
	status === 429
		? RATE_LIMIT_RETRY_DELAYS_MS
		: TEMPORARY_ERROR_RETRY_DELAYS_MS;

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
			if (attempt === TEMPORARY_ERROR_RETRY_DELAYS_MS.length) throw error;
			const delay = TEMPORARY_ERROR_RETRY_DELAYS_MS[attempt];
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`${label} failed: ${message}; retrying in ${delay}ms`);
			await sleep(delay);
			continue;
		}

		if (response.ok) return await response.json();
		if (response.status === 404) return null;

		const message = `${label} failed: ${response.status} ${response.statusText}`;
		const retryDelays = getRetryDelays(response.status);
		if (
			!RETRYABLE_STATUS_CODES.has(response.status) ||
			attempt === retryDelays.length
		) {
			throw new Error(message);
		}

		const delay =
			parseRetryAfterHeader(response.headers.get("retry-after")) ??
			retryDelays[attempt];
		console.warn(`${message}; retrying in ${delay}ms`);
		await sleep(delay);
	}

	throw new Error(`${label} failed after retries`);
};

const getFoodName = (food) =>
	food?.description || food?.name || food?.productName || food?.product_name || "";

const collectBarcodeCandidates = async (supabase) => {
	const [listItems, customFoods, sharedProducts, existingImages] =
		await Promise.all([
			fetchAllRows(() => supabase.from("user_food_list_items").select("id, food")),
			fetchAllRows(() =>
				supabase.from("custom_foods").select("id, barcode, food"),
			),
			fetchAllRows(() =>
				supabase
					.from("shared_products")
					.select("id, barcode, product_name, status"),
			),
			fetchAllRows(() =>
				supabase
					.from("food_image_assets")
					.select("barcode, status, image_role")
					.eq("status", "active"),
			),
		]);

	const sharedProductByBarcode = new Map();
	for (const product of sharedProducts) {
		const barcode = normalizeBarcode(product.barcode);
		if (!barcode) continue;
		const existing = sharedProductByBarcode.get(barcode);
		if (!existing || product.status === "active") {
			sharedProductByBarcode.set(barcode, product);
		}
	}

	const activeImageBarcodes = new Set(
		existingImages
			.filter((image) => image.barcode && image.image_role === "front")
			.map((image) => image.barcode),
	);
	const candidates = new Map();
	const addCandidate = ({ barcode, source, label }) => {
		const normalized = normalizeBarcode(barcode);
		if (!normalized || activeImageBarcodes.has(normalized)) return;

		const existing = candidates.get(normalized) ?? {
			barcode: normalized,
			labels: new Set(),
			sources: new Set(),
			sharedProductId: sharedProductByBarcode.get(normalized)?.id ?? null,
		};
		existing.sources.add(source);
		if (label) existing.labels.add(label);
		candidates.set(normalized, existing);
	};

	for (const item of listItems) {
		addCandidate({
			barcode: item.food?.barcode ?? item.food?.gtinUpc ?? item.food?.gtin_upc,
			source: "user_food_list_items",
			label: getFoodName(item.food),
		});
	}

	for (const food of customFoods) {
		addCandidate({
			barcode: food.barcode ?? food.food?.barcode ?? food.food?.gtinUpc,
			source: "custom_foods",
			label: getFoodName(food.food),
		});
	}

	for (const product of sharedProducts) {
		addCandidate({
			barcode: product.barcode,
			source: "shared_products",
			label: product.product_name,
		});
	}

	const rows = [...candidates.values()].map((candidate) => ({
		...candidate,
		labels: [...candidate.labels],
		sources: [...candidate.sources],
	}));

	return Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
};

const parseOpenFoodFactsImage = (product, barcode) => {
	const imageUrl = product?.image_front_url || product?.image_url;
	if (!imageUrl) return null;

	return {
		barcode,
		source: "open-food-facts",
		source_reference: barcode,
		image_role: "front",
		image_url: imageUrl,
		thumbnail_url:
			product.image_front_small_url ||
			product.image_front_thumb_url ||
			product.image_small_url ||
			product.image_thumb_url ||
			imageUrl,
		license_name: OPEN_FOOD_FACTS_IMAGE_LICENSE.name,
		license_url: OPEN_FOOD_FACTS_IMAGE_LICENSE.url,
		attribution_text: OPEN_FOOD_FACTS_IMAGE_LICENSE.attribution,
		confidence: "imported",
		status: "active",
		fetched_at: new Date().toISOString(),
	};
};

const lookupOpenFoodFactsImage = async (barcode) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;
	const candidateMatch = await findFirstBarcodeCandidateMatch(
		barcode,
		async (candidate) => {
			const url = new URL(
				`${OPEN_FOOD_FACTS_PRODUCT_URL}/${encodeURIComponent(candidate)}.json`,
			);
			url.searchParams.set("fields", OPEN_FOOD_FACTS_IMAGE_FIELDS);
			const data = await fetchJson(
				url,
				{
					headers: {
						accept: "application/json",
						"user-agent": APP_USER_AGENT,
					},
				},
				`Open Food Facts image lookup for ${candidate}`,
			);
			if (!data || data.status !== 1 || !data.product) return null;
			if (
				normalizeBarcode(data.product.code ?? candidate) !== canonicalBarcode
			) return null;

			return {
				image: parseOpenFoodFactsImage(data.product, canonicalBarcode),
			};
		},
	);

	return candidateMatch?.value.image ?? null;
};

const persistFoodImageAsset = async (supabase, image, sharedProductId) => {
	const payload = {
		...image,
		shared_product_id: sharedProductId ?? null,
	};

	const { data, error } = await supabase
		.from("food_image_assets")
		.update(payload)
		.eq("source", payload.source)
		.eq("source_reference", payload.source_reference)
		.eq("image_role", payload.image_role)
		.select("id")
		.maybeSingle();

	if (error) throw error;
	if (data) return "updated";

	const { error: insertError } = await supabase
		.from("food_image_assets")
		.insert(payload);
	if (insertError && insertError.code !== "23505") throw insertError;
	return "inserted";
};

const supabase = createSupabaseClient();
const candidates = await collectBarcodeCandidates(supabase);
console.log(`Found ${candidates.length} barcode(s) without active front images.`);

const summary = {
	found: 0,
	inserted: 0,
	updated: 0,
	missing: 0,
	errors: 0,
};

for (const [index, candidate] of candidates.entries()) {
	const label = candidate.labels[0] ? ` — ${candidate.labels[0]}` : "";
	console.log(`[${index + 1}/${candidates.length}] ${candidate.barcode}${label}`);
	try {
		const image = await lookupOpenFoodFactsImage(candidate.barcode);
		await sleep(REQUEST_DELAY_MS);
		if (!image) {
			summary.missing += 1;
			console.log("  no source image found");
			continue;
		}

		summary.found += 1;
		if (dryRun) {
			console.log(`  found image: ${image.image_url}`);
			continue;
		}

		const result = await persistFoodImageAsset(
			supabase,
			image,
			candidate.sharedProductId,
		);
		summary[result] += 1;
		console.log(`  ${result}: ${image.image_url}`);
	} catch (error) {
		summary.errors += 1;
		console.warn(error instanceof Error ? `  ${error.message}` : error);
	}
}

console.table(summary);
if (dryRun) {
	console.log("Dry run complete. No database rows were written.");
}
