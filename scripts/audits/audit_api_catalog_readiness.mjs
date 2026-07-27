/**
 * Purpose: Audit every active shared-products catalog row against the blendCalc API v1
 * publication gate and print its canonical provenance, normalized data coverage, asset
 * coverage, and any reason the row is withheld from API reads. This script is read-only.
 * Run: `npm run audit:api-catalog`
 * Strict: `npm run audit:api-catalog -- --strict`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const strict = process.argv.includes("--strict");

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
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

const readRows = async (label, request) => {
	const { data, error } = await request;
	if (error) throw new Error(`${label}: ${error.message}`);
	return data ?? [];
};

const groupCounts = (rows, parentKey) => {
	const counts = new Map();
	for (const row of rows) {
		const parentId = row[parentKey];
		if (!parentId) continue;
		counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
	}
	return counts;
};

const groupRows = (rows, parentKey) => {
	const grouped = new Map();
	for (const row of rows) {
		const parentId = row[parentKey];
		if (!parentId) continue;
		grouped.set(parentId, [...(grouped.get(parentId) ?? []), row]);
	}
	return grouped;
};

const summarizeSources = (rows, readSource) => {
	const counts = new Map();
	for (const row of rows) {
		const source = readSource(row);
		if (!source) continue;
		counts.set(source, (counts.get(source) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([source, count]) => `${source}:${count}`)
		.join(", ");
};

const readObservation = (row) => Array.isArray(row.shared_product_observations)
	? row.shared_product_observations[0]
	: row.shared_product_observations;

const products = await readRows(
	"Active shared products",
	supabase
		.from("shared_products")
		.select("id, barcode, product_name, source, category_option_id")
		.eq("status", "active")
		.order("product_name"),
);
const productIds = products.map((product) => product.id);

const [readiness, provenance, nutrients, servings, images] = await Promise.all([
	readRows(
		"API readiness",
		supabase
			.from("blendcalc_api_v1_product_readiness")
			.select("shared_product_id, publishable, reasons"),
	),
	productIds.length
		? readRows(
			"Selected field provenance",
			supabase
			.from("shared_product_field_provenance")
				.select(
					"shared_product_id, field_path, confidence, verification_method, shared_product_observations(source, source_reference)",
				)
				.in("shared_product_id", productIds)
				.eq("selected", true),
		)
		: [],
	productIds.length
		? readRows(
			"Normalized nutrients",
			supabase
			.from("food_nutrients")
				.select(
					"shared_product_id, nutrient_id, source, source_reference, confidence",
				)
				.in("shared_product_id", productIds),
		)
		: [],
	productIds.length
		? readRows(
			"Normalized servings",
			supabase
			.from("food_servings")
				.select(
					"shared_product_id, label, source, source_reference, confidence",
				)
				.in("shared_product_id", productIds),
		)
		: [],
	productIds.length
		? readRows(
			"Active images",
			supabase
				.from("food_image_assets")
				.select(
					"shared_product_id, source, source_reference, license_name, license_url, attribution_text",
				)
				.in("shared_product_id", productIds)
				.eq("status", "active"),
		)
		: [],
]);

const readinessByProduct = new Map(
	readiness.map((row) => [row.shared_product_id, row]),
);
const provenanceCounts = groupCounts(provenance, "shared_product_id");
const nutrientCounts = groupCounts(nutrients, "shared_product_id");
const servingCounts = groupCounts(servings, "shared_product_id");
const imageCounts = groupCounts(images, "shared_product_id");
const provenanceByProduct = groupRows(provenance, "shared_product_id");
const nutrientsByProduct = groupRows(nutrients, "shared_product_id");
const servingsByProduct = groupRows(servings, "shared_product_id");
const imagesByProduct = groupRows(images, "shared_product_id");
const incompleteImageRights = new Set(
	images
		.filter(
			(image) =>
				!image.license_name?.trim() ||
				!image.license_url?.trim() ||
				!image.attribution_text?.trim(),
		)
		.map((image) => image.shared_product_id)
		.filter(Boolean),
);

const report = products.map((product) => {
	const status = readinessByProduct.get(product.id);
	const productImages = imagesByProduct.get(product.id) ?? [];
	return {
		barcode: product.barcode,
		product: product.product_name,
		catalogSource: product.source,
		api: status?.publishable ? "included" : "withheld",
		reasons: (status?.reasons ?? ["readiness_not_evaluated"]).join(", "),
		category: product.category_option_id ? "yes" : "no",
		fieldSources: provenanceCounts.get(product.id) ?? 0,
		fieldLineage: (provenanceByProduct.get(product.id) ?? [])
			.sort((left, right) => left.field_path.localeCompare(right.field_path))
			.map((row) =>
				`${row.field_path}=${readObservation(row)?.source ?? "missing"}`
			)
			.join(", "),
		nutrients: nutrientCounts.get(product.id) ?? 0,
		nutrientSources: summarizeSources(
			nutrientsByProduct.get(product.id) ?? [],
			(row) => row.source,
		),
		servings: servingCounts.get(product.id) ?? 0,
		servingSources: summarizeSources(
			servingsByProduct.get(product.id) ?? [],
			(row) => row.source,
		),
		images: productImages.length,
		imageSources: summarizeSources(
			productImages,
			(row) => row.source,
		),
		imageRights: productImages.length === 0
			? "none"
			: incompleteImageRights.has(product.id)
				? "incomplete"
				: "complete",
	};
});

console.table(report);
const included = report.filter((row) => row.api === "included").length;
const withheld = report.length - included;
console.log(JSON.stringify({
	activeSharedProducts: report.length,
	apiIncluded: included,
	apiWithheld: withheld,
	allIncludedRowsPassedPolicyGate: report
		.filter((row) => row.api === "included")
		.every((row) => row.reasons === ""),
}, null, 2));

if (strict && withheld > 0) {
	process.exitCode = 1;
}
