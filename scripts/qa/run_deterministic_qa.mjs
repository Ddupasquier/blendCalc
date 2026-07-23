/**
 * Purpose: Verify remote data invariants that are deterministic and safe to automate:
 * imported dataset metadata, source registry policy, metrics privacy, canonical catalog
 * reads, search pagination, category pagination, image/serving fixtures, and API privacy.
 * It performs read-only Supabase requests and never creates users or Fridge records.
 * Run: `npm run qa:deterministic`
 */

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import WebSocket from "ws";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
	);
}

const createSupabaseClient = (key) => createClient(supabaseUrl, key, {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false,
	},
	realtime: { transport: WebSocket },
});

const admin = createSupabaseClient(serviceRoleKey);
const publicClient = createSupabaseClient(publishableKey);
const passedChecks = [];

const assert = (condition, message) => {
	if (!condition) throw new Error(message);
};

const requireData = (result, label) => {
	if (result.error) throw new Error(`${label}: ${result.error.message}`);
	return result.data ?? [];
};

const pass = (label) => {
	passedChecks.push(label);
	console.log(`PASS ${label}`);
};

const assertDatasetCatalog = async () => {
	const datasets = requireData(
		await admin
			.from("generic_food_datasets")
			.select("key, active, import_enabled, license_review_status, source_url, license_url, attribution_text, imported_at, source_file_sha256, food_count, nutrient_value_count, measure_count")
			.in("key", ["cnf-2026", "cofid-2021", "afcd-release-3"]),
		"generic food datasets",
	);
	const byKey = new Map(datasets.map((dataset) => [dataset.key, dataset]));
	const cnf = byKey.get("cnf-2026");
	const cofid = byKey.get("cofid-2021");
	const afcd = byKey.get("afcd-release-3");

	assert(cnf?.active && cnf.import_enabled, "CNF 2026 is not active/import-enabled.");
	assert(cnf.license_review_status === "approved", "CNF 2026 is not legally approved.");
	assert(cnf.food_count === 5993, `CNF food count is ${cnf.food_count}, expected 5993.`);
	assert(cnf.nutrient_value_count === 565409, `CNF nutrient count is ${cnf.nutrient_value_count}, expected 565409.`);
	assert(cnf.measure_count === 29867, `CNF measure count is ${cnf.measure_count}, expected 29867.`);

	assert(cofid?.active && cofid.import_enabled, "CoFID 2021 is not active/import-enabled.");
	assert(cofid.license_review_status === "approved", "CoFID 2021 is not legally approved.");
	assert(cofid.food_count === 2887, `CoFID food count is ${cofid.food_count}, expected 2887.`);
	assert(cofid.nutrient_value_count === 199415, `CoFID nutrient count is ${cofid.nutrient_value_count}, expected 199415.`);

	for (const dataset of [cnf, cofid]) {
		assert(dataset.source_url?.startsWith("https://"), `${dataset.key} lacks a source URL.`);
		assert(dataset.license_url?.startsWith("https://"), `${dataset.key} lacks a license URL.`);
		assert(dataset.attribution_text?.trim(), `${dataset.key} lacks attribution.`);
		assert(dataset.imported_at, `${dataset.key} lacks an import timestamp.`);
		assert(/^[a-f0-9]{64}$/.test(dataset.source_file_sha256 ?? ""), `${dataset.key} lacks a valid file hash.`);
	}

	assert(afcd?.license_review_status === "requires_acceptance", "AFCD legal gate changed unexpectedly.");
	assert(!afcd.import_enabled && !afcd.active, "AFCD must stay disabled before terms acceptance.");

	const profiles = requireData(
		await admin
			.from("nutrition_completeness_profiles")
			.select("key")
			.eq("enabled", true),
		"nutrition completeness profiles",
	);
	const profileNutrients = requireData(
		await admin
			.from("nutrition_completeness_profile_nutrients")
			.select("profile_key, nutrient_id, requirement_level"),
		"nutrition completeness profile nutrients",
	);
	assert(profiles.length > 0, "No enabled nutrition completeness profiles exist.");
	for (const profile of profiles) {
		assert(
			profileNutrients.some((row) => row.profile_key === profile.key),
			`Completeness profile ${profile.key} has no nutrient rows.`,
		);
	}
	pass("QA-053-001 dataset metadata and DB-owned completeness policy");
};

const assertSourceRegistry = async () => {
	const sources = requireData(
		await admin
			.from("product_data_sources")
			.select("key, enabled, provenance")
			.in("key", ["foodrepo", "nutrition-label-ocr", "gs1-digital-link"]),
		"product data sources",
	);
	const byKey = new Map(sources.map((source) => [source.key, source]));
	const foodRepo = byKey.get("foodrepo");
	const ocr = byKey.get("nutrition-label-ocr");
	const gs1 = byKey.get("gs1-digital-link");

	assert(foodRepo && !foodRepo.enabled, "FoodRepo must remain disabled.");
	assert(foodRepo.provenance?.retired_on === "2026-02-28", "FoodRepo retirement date is missing.");
	assert(foodRepo.provenance?.replacement_source_key === "open-food-facts", "FoodRepo replacement is missing.");
	assert(ocr?.provenance?.requires_user_confirmation === true, "OCR must remain confirmation-only.");
	assert(gs1?.provenance?.role === "product_identifier_carrier", "GS1 role is incorrect.");
	assert(gs1.provenance?.network_policy === "never_fetch_arbitrary_scanned_urls", "GS1 network policy is unsafe.");

	const evaluations = requireData(
		await admin
			.from("product_source_evaluations")
			.select("source_key, decision, sample_size, summary, details")
			.eq("source_key", "foodrepo")
			.order("evaluated_at", { ascending: false })
			.limit(1),
		"FoodRepo evaluation",
	);
	const evaluation = evaluations[0];
	assert(evaluation?.decision === "retired", "FoodRepo evaluation is not retired.");
	assert(evaluation.sample_size === 0, "FoodRepo should not claim a completed benchmark.");
	assert(/not run|not enter/i.test(evaluation.summary), "FoodRepo evaluation does not explain the skipped benchmark.");
	assert(evaluation.details?.planned_sample_size === 200, "FoodRepo planned sample size is not recorded.");
	pass("QA-053-005 external source lifecycle and safety registry");
};

const readMetrics = async () => requireData(
	await admin
		.from("product_source_daily_metrics")
		.select("metric_date, source_key, source_data_type, lookup_kind, lookup_origin, lookup_count, api_request_count, api_error_count, cache_hit_count, completed_lookup_count, match_count, exact_barcode_match_count, error_count, evaluated_product_count, reported_nutrient_total, brand_present_count, category_present_count, serving_present_count, ingredients_present_count, image_present_count, response_milliseconds_total"),
	"source metrics",
);

const assertMetricsPrivacy = async () => {
	const metrics = await readMetrics();
	const forbiddenKeys = new Set([
		"barcode",
		"query",
		"query_text",
		"user_id",
		"raw_payload",
	]);
	for (const row of metrics) {
		for (const key of Object.keys(row)) {
			assert(!forbiddenKeys.has(key), `Metrics expose forbidden field ${key}.`);
		}
	}

	const publicRead = await publicClient
		.from("product_source_daily_metrics")
		.select("metric_date")
		.limit(1);
	assert(publicRead.error, "Publishable-key client can read service-only source metrics.");
	pass("QA-038-003 aggregate-only metrics and service-role access");
};

const assertCatalogReads = async () => {
	const metricsBefore = JSON.stringify(await readMetrics());
	const productResults = [];
	for (const barcode of ["00021130493609", "00021130462506"]) {
		const rows = requireData(
			await admin.rpc("get_blendcalc_product_v1", { p_barcode: barcode }),
			`catalog product ${barcode}`,
		);
		assert(rows.length === 1, `Active catalog product ${barcode} was not found.`);
		productResults.push(rows[0]);
	}
	const [pastaSauce, jelly] = productResults;

	const servings = requireData(
		await admin
			.from("food_servings")
			.select("label, gram_weight, amount, unit_key, is_primary")
			.eq("shared_product_id", pastaSauce.id),
		"pasta sauce servings",
	);
	assert(
		servings.some((serving) =>
			Number(serving.gram_weight) === 125
			&& Number(serving.amount) === 0.5
			&& serving.unit_key === "cup"
		),
		`Pasta sauce is missing its stored 125g / 1/2 cup serving: ${JSON.stringify(servings)}.`,
	);

	const pastaImages = requireData(
		await admin
			.from("food_image_assets")
			.select("id, image_url, thumbnail_url, license_name, attribution_text, fit_mode, placement_version")
			.eq("shared_product_id", pastaSauce.id)
			.eq("status", "active"),
		"pasta sauce images",
	);
	assert(pastaImages.length > 0, "Pasta sauce has no active approved image metadata.");
	for (const image of pastaImages) {
		assert(image.image_url?.startsWith("http"), "An active image lacks a usable URL.");
		assert(image.license_name?.trim(), "An active image lacks license metadata.");
	}

	const jellyImages = requireData(
		await admin
			.from("food_image_assets")
			.select("id")
			.eq("shared_product_id", jelly.id)
			.eq("status", "active"),
		"jelly images",
	);
	assert(jellyImages.length === 0, "Jelly unexpectedly has an active image; update its QA fixture.");

	const firstPage = requireData(
		await admin.rpc("search_blendcalc_products_v1", {
			p_query: "tomato",
			p_terms: ["tomato"],
			p_limit: 15,
			p_offset: 0,
		}),
		"catalog search page 1",
	);
	assert(firstPage.length <= 15, "Catalog search exceeded its requested page size.");
	const total = Number(firstPage[0]?.total_count ?? 0);
	const secondPage = total > firstPage.length
		? requireData(
			await admin.rpc("search_blendcalc_products_v1", {
				p_query: "tomato",
				p_terms: ["tomato"],
				p_limit: 15,
				p_offset: 15,
			}),
			"catalog search page 2",
		)
		: [];
	assert(
		secondPage.length === 0 || Number(secondPage[0]?.total_count ?? 0) === total,
		"Catalog search totals changed between pages.",
	);
	const firstIds = new Set(firstPage.map((product) => product.id));
	assert(!secondPage.some((product) => firstIds.has(product.id)), "Catalog search pages contain duplicate IDs.");
	const nameMatchPosition = (name) => String(name).toLowerCase().indexOf("tomato");
	const positions = firstPage.map((product) => nameMatchPosition(product.product_name));
	for (let index = 1; index < positions.length; index += 1) {
		assert(
			positions[index - 1] <= positions[index] || positions[index] === -1,
			"Catalog search relevance regressed for tomato.",
		);
	}

	const privateSearch = requireData(
		await admin.rpc("search_blendcalc_products_v1", {
			p_query: "QA-005-015 Test",
			p_terms: ["qa", "005", "015", "test"],
			p_limit: 15,
			p_offset: 0,
		}),
		"private-name catalog search",
	);
	assert(privateSearch.length === 0, "An account-only QA ingredient leaked into the canonical catalog.");

	const categories = requireData(
		await admin
			.from("custom_food_category_options")
			.select("id, label, normalized_value, updated_at")
			.eq("enabled", true)
			.order("label", { ascending: true })
			.order("id", { ascending: true })
			.range(0, 24),
		"API category page",
	);
	assert(categories.length <= 25, "Category page exceeded 25 rows.");
	for (let index = 1; index < categories.length; index += 1) {
		assert(
			categories[index - 1].label.localeCompare(categories[index].label) <= 0,
			"Enabled categories are not alphabetized.",
		);
	}
	assert(categories.every((category) =>
		category.id && category.label && category.normalized_value && category.updated_at
	), "A category is missing API-required metadata.");

	const metricsAfter = JSON.stringify(await readMetrics());
	assert(metricsAfter === metricsBefore, "Stored blendCalc catalog reads changed provider API metrics.");
	pass("QA-058-001 through QA-058-003 and QA-058-005 through QA-058-006 catalog data invariants");
};

const assertOpenApiContract = async () => {
	const specification = JSON.parse(
		await readFile("static/api/v1/openapi.json", "utf8"),
	);
	assert(specification.openapi === "3.1.0", "OpenAPI document is not version 3.1.0.");
	const paths = Object.keys(specification.paths ?? {}).sort();
	assert(
		JSON.stringify(paths) === JSON.stringify([
			"/api/v1/categories",
			"/api/v1/foods/search",
			"/api/v1/products/{barcode}",
		]),
		"OpenAPI document advertises an unexpected endpoint set.",
	);
	for (const path of paths) {
		assert(
			Object.keys(specification.paths[path]).every((method) => method === "get"),
			`${path} advertises a non-GET operation.`,
		);
	}
	assert(specification.security?.[0]?.cookieAuth, "OpenAPI does not require the app session.");
	pass("QA-058-004 read-only authenticated OpenAPI contract");
};

await assertDatasetCatalog();
await assertSourceRegistry();
await assertMetricsPrivacy();
await assertCatalogReads();
await assertOpenApiContract();

console.log(`\n${passedChecks.length} deterministic QA groups passed.`);
