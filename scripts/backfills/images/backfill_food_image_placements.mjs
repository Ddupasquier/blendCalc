/**
 * Purpose: Safely add automatic OCR card placement to existing active front images
 * whose placement is still an untouched default or untouched legacy source import.
 * The script never changes a user adjustment, moderator placement, or previously
 * accepted smart placement. Ambiguous OCR stays unchanged. Run the dry-run first;
 * the live run is idempotent.
 * Preview: `node scripts/backfills/images/backfill_food_image_placements.mjs --dry-run`
 * Execute: `node scripts/backfills/images/backfill_food_image_placements.mjs`
 * Limit: `node scripts/backfills/images/backfill_food_image_placements.mjs --dry-run --limit=25`
 */

import { config } from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	getBarcodeLookupCandidates,
	normalizeBarcode,
} from "../../lib/barcode/barcode_candidates.mjs";
import { createAppUserAgent } from "../../lib/releases/app_version.mjs";
import {
	createSmartImagePlacementWorker,
	suggestStoredImagePlacement,
} from "../../lib/images/smart_image_placement.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");
const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
const limit = limitArgument
	? Number.parseInt(limitArgument.split("=")[1] ?? "", 10)
	: null;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const PAGE_SIZE = 250;
const OPEN_FOOD_FACTS_PRODUCT_ENDPOINTS = [
	"https://world.openfoodfacts.org/api/v2/product",
	"https://world.openfoodfacts.net/api/v2/product",
];
const APP_USER_AGENT = createAppUserAgent("automatic image placement backfill");

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
	realtime: { transport: WebSocket },
});

const fetchAllRows = async (buildQuery) => {
	const rows = [];
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < PAGE_SIZE) break;
	}
	return rows;
};

const getProductName = (image, productById) => {
	const product = image.shared_product_id
		? productById.get(image.shared_product_id)
		: null;
	return product?.product_name?.trim() || "";
};

const getBrandName = (image, productById) => {
	const product = image.shared_product_id
		? productById.get(image.shared_product_id)
		: null;
	return product?.brand_owner?.trim() || "";
};

const isUntouchedPlacement = (image) => {
	const hasUntouchedCoordinates =
		Number(image.crop_x) === 50 &&
		Number(image.crop_y) === 50 &&
		Number(image.crop_zoom) === 1 &&
		Number(image.rotation_degrees) === 0 &&
		image.crop_source === "auto";
	if (!hasUntouchedCoordinates || image.approved_by) return false;
	return (
		(image.placement_method === "default" &&
			image.placement_version === 2 &&
			image.fit_mode === "contain") ||
		(image.placement_method === "manual" &&
			image.placement_version === 1 &&
			image.fit_mode === "cover")
	);
};

const fetchOpenFoodFactsIdentity = async (barcode) => {
	let lastFailureStatus = null;
	for (const endpoint of OPEN_FOOD_FACTS_PRODUCT_ENDPOINTS) {
		for (const candidate of getBarcodeLookupCandidates(barcode)) {
			const response = await fetch(
				`${endpoint}/${encodeURIComponent(candidate)}.json?fields=code,product_name,brands`,
				{
					headers: { "User-Agent": APP_USER_AGENT },
					signal: AbortSignal.timeout(20_000),
				},
			);
			if (response.status === 404) continue;
			if (!response.ok) {
				lastFailureStatus = response.status;
				break;
			}
			const payload = await response.json();
			const productName = String(payload?.product?.product_name ?? "").trim();
			if (!productName) continue;
			return {
				productName,
				brandName: String(payload?.product?.brands ?? "").trim(),
			};
		}
	}
	if (lastFailureStatus) {
		throw new Error(`Open Food Facts identity request failed with ${lastFailureStatus}.`);
	}
	return null;
};

const getOpenFoodFactsFullImageUrl = (url) => {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.hostname !== "images.openfoodfacts.org") return url;
		parsedUrl.pathname = parsedUrl.pathname.replace(
			/\.(?:100|200|400)\.jpg$/i,
			".full.jpg",
		);
		return parsedUrl.toString();
	} catch {
		return url;
	}
};

const getBestPlacementImageUrl = (candidate) =>
	candidate.source === "open-food-facts"
		? getOpenFoodFactsFullImageUrl(candidate.image_url)
		: candidate.image_url;

const loadCandidates = async () => {
	const [images, products, customFoods, listItems] = await Promise.all([
		fetchAllRows(() =>
			supabase
				.from("food_image_assets")
				.select("id, barcode, shared_product_id, image_url, source, placement_method, placement_version, fit_mode, crop_x, crop_y, crop_zoom, rotation_degrees, crop_source, approved_by, status, image_role")
				.eq("status", "active")
				.eq("image_role", "front")
				.eq("crop_x", 50)
				.eq("crop_y", 50)
				.eq("crop_zoom", 1)
				.eq("rotation_degrees", 0)
				.eq("crop_source", "auto")
				.is("approved_by", null),
		),
		fetchAllRows(() =>
			supabase
				.from("shared_products")
				.select("id, barcode, product_name, brand_owner")
				.eq("status", "active"),
		),
		fetchAllRows(() =>
			supabase
				.from("custom_foods")
				.select("barcode, food")
				.not("barcode", "is", null),
		),
		fetchAllRows(() =>
			supabase
				.from("user_food_list_items")
				.select("food")
		),
	]);
	const productById = new Map(products.map((product) => [product.id, product]));
	const identityByBarcode = new Map();
	for (const product of products) {
		const barcode = normalizeBarcode(product.barcode);
		if (!barcode) continue;
		identityByBarcode.set(barcode, {
			productName: product.product_name?.trim() || "",
			brandName: product.brand_owner?.trim() || "",
		});
	}
	const rememberFoodIdentity = (barcode, food) => {
		const canonicalBarcode = normalizeBarcode(barcode);
		if (!canonicalBarcode || identityByBarcode.has(canonicalBarcode) || !food) return;
		const productName = String(
			food.description ?? food.name ?? food.productName ?? "",
		).trim();
		if (!productName) return;
		identityByBarcode.set(canonicalBarcode, {
			productName,
			brandName: String(food.brandOwner ?? food.brandName ?? food.brand ?? "").trim(),
		});
	};
	for (const customFood of customFoods) {
		rememberFoodIdentity(customFood.barcode, customFood.food);
	}
	for (const listItem of listItems) {
		const barcode = String(
			listItem.food?.barcode ??
				listItem.food?.gtinUpc ??
				listItem.food?.gtin_upc ??
				"",
		).trim();
		rememberFoodIdentity(barcode, listItem.food);
	}
	const candidates = images
		.filter(isUntouchedPlacement)
		.map((image) => {
			const barcodeIdentity = image.barcode
				? identityByBarcode.get(normalizeBarcode(image.barcode))
				: null;
			return {
				...image,
				productName:
					getProductName(image, productById) ||
					barcodeIdentity?.productName ||
					"",
				brandName:
					getBrandName(image, productById) ||
					barcodeIdentity?.brandName ||
					"",
			};
		})
		.filter((image) => image.image_url);
	for (const candidate of candidates) {
		if (candidate.productName || candidate.source !== "open-food-facts") continue;
		const barcode = normalizeBarcode(candidate.barcode);
		if (!barcode) continue;
		try {
			const identity = await fetchOpenFoodFactsIdentity(barcode);
			if (identity) Object.assign(candidate, identity);
		} catch (error) {
			console.warn(
				`Could not resolve the stored image identity for ${barcode}: ${error instanceof Error ? error.message : error}`,
			);
		}
	}
	const namedCandidates = candidates.filter((image) => image.productName);
	return Number.isFinite(limit) && limit > 0
		? namedCandidates.slice(0, limit)
		: namedCandidates;
};

const fetchImageBuffer = async (url) => {
	const response = await fetch(url, {
		redirect: "follow",
		signal: AbortSignal.timeout(20_000),
	});
	if (!response.ok) {
		throw new Error(`Image request failed with ${response.status}.`);
	}
	const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.startsWith("image/")) {
		throw new Error("Image URL did not return an image.");
	}
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
		throw new Error("Image exceeds the backfill size limit.");
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length > MAX_IMAGE_BYTES) {
		throw new Error("Image exceeds the backfill size limit.");
	}
	return buffer;
};

const createFullImagePlacementUpgrade = () => ({
	crop_x: 50,
	crop_y: 50,
	crop_zoom: 1,
	rotation_degrees: 0,
	fit_mode: "contain",
	placement_version: 2,
	placement_method: "default",
	placement_suggestion_version: null,
	placement_suggestion_confidence: null,
	placement_suggestion_accepted_at: null,
	crop_source: "auto",
});

const candidates = await loadCandidates();
console.log(`Found ${candidates.length} untouched front-image placement(s).`);
const summary = {
	scanned: 0,
	automatic: 0,
	fullImageFallback: 0,
	updated: 0,
	ambiguous: 0,
	errors: 0,
};
const worker = await createSmartImagePlacementWorker();

try {
	for (const [index, candidate] of candidates.entries()) {
		console.log(`[${index + 1}/${candidates.length}] ${candidate.productName}`);
		try {
			const imageBuffer = await fetchImageBuffer(
				getBestPlacementImageUrl(candidate),
			);
			const suggestedPlacement = await suggestStoredImagePlacement({
				worker,
				imageBuffer,
				productName: candidate.productName,
				brandName: candidate.brandName,
			});
			summary.scanned += 1;
			const upgradesLegacyDefault = candidate.placement_version === 1;
			const placement = suggestedPlacement ??
				(upgradesLegacyDefault ? createFullImagePlacementUpgrade() : null);
			if (!placement) {
				summary.ambiguous += 1;
				console.log("  unchanged: no confident product-label match");
				continue;
			}
			if (suggestedPlacement) {
				summary.automatic += 1;
				console.log(
					`  ${dryRun ? "would place" : "place"}: ${placement.rotation_degrees}°, ${placement.crop_zoom}×, confidence ${placement.placement_suggestion_confidence}`,
				);
			} else {
				summary.fullImageFallback += 1;
				console.log(
					`  ${dryRun ? "would upgrade" : "upgrade"}: current full-image fallback`,
				);
			}
			if (dryRun) continue;

			const { data, error } = await supabase
				.from("food_image_assets")
				.update(placement)
				.eq("id", candidate.id)
				.eq("placement_method", candidate.placement_method)
				.eq("placement_version", candidate.placement_version)
				.eq("fit_mode", candidate.fit_mode)
				.eq("crop_x", 50)
				.eq("crop_y", 50)
				.eq("crop_zoom", 1)
				.eq("rotation_degrees", 0)
				.eq("crop_source", "auto")
				.is("approved_by", null)
				.select("id")
				.maybeSingle();
			if (error) throw error;
			if (!data) {
				throw new Error("Placement changed during the backfill; the row was left untouched.");
			}
			summary.updated += 1;
		} catch (error) {
			summary.errors += 1;
			console.warn(error instanceof Error ? `  ${error.message}` : error);
		}
	}
} finally {
	await worker.terminate();
}

console.table(summary);
if (dryRun) console.log("Dry run complete. No database rows were written.");
if (summary.errors > 0) process.exitCode = 1;
