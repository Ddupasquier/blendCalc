/**
 * Purpose: Resolve active shared products to canonical DB categories using stored data,
 * exact-barcode USDA and Open Food Facts evidence; retain source observations; and
 * update matching products, submissions, and revisions. Name-only provider matches are
 * deliberately ignored because they cannot establish product identity. The live command
 * also removes invalid category links, so review the read-only preview first.
 * Preview: `node scripts/backfills/catalog/backfill_shared_product_categories.mjs --dry-run`
 * Execute: `node scripts/backfills/catalog/backfill_shared_product_categories.mjs`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import {
	normalizeFoodCategoryValue,
	toFoodCategoryId,
	toFoodCategoryLabel,
} from "../../../src/lib/utils/food/categories/categoryNormalization.js";
import {
	findFirstBarcodeCandidateMatch,
	normalizeBarcode,
} from "../../lib/barcode/barcode_candidates.mjs";
import { createAppUserAgent } from "../../lib/releases/app_version.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const isDryRun = process.argv.includes("--dry-run");
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fdcApiKey =
	process.env.FDC_API_KEY?.trim() || process.env.VITE_FDC_API_KEY?.trim();
const APP_USER_AGENT = createAppUserAgent("shared product category backfill");
const OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"brands",
	"categories",
	"categories_tags",
	"categories_hierarchy",
	"food_groups",
	"food_groups_tags",
	"main_category",
].join(",");
const MAX_ATTEMPTS = 3;
const INVALID_CATEGORY_VALUES = new Set([
	"n a",
	"none",
	"not applicable",
	"null",
	"undefined",
	"unknown",
]);

if (!supabaseUrl || !serviceRoleKey || !fdcApiKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FDC_API_KEY are required.",
	);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: { autoRefreshToken: false, persistSession: false },
	realtime: { transport: ws },
});

const sleep = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchJson = async (url, label, options = {}) => {
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		const response = await fetch(url, options);
		if (response.ok) return response.json();
		if (response.status === 404) return null;
		if (response.status !== 429 && response.status < 500) {
			throw new Error(`${label} failed with ${response.status}.`);
		}
		if (attempt === MAX_ATTEMPTS) {
			throw new Error(`${label} failed after ${MAX_ATTEMPTS} attempts.`);
		}
		await sleep(response.status === 429 ? attempt * 4_000 : attempt * 1_000);
	}
	return null;
};

const uniqueValues = (values) => {
	const seen = new Set();
	return values.flatMap((value) => {
		const trimmed = String(value ?? "").trim();
		const normalized = normalizeFoodCategoryValue(trimmed);
		if (
			!normalized ||
			INVALID_CATEGORY_VALUES.has(normalized) ||
			seen.has(normalized)
		)
			return [];
		seen.add(normalized);
		return [trimmed];
	});
};

const splitValues = (value) =>
	String(value ?? "")
		.split(/[;,]/)
		.map((item) => item.trim())
		.filter(Boolean);

const getFdcCategoryValues = (foodCategory) => {
	if (!foodCategory) return [];
	if (typeof foodCategory === "string") return [foodCategory];
	return [
		foodCategory.description,
		foodCategory.code,
		foodCategory.type,
	].filter(Boolean);
};

const lookupUsdaCategories = async (barcode) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return { values: [], observations: [] };
	const candidateMatch = await findFirstBarcodeCandidateMatch(
		barcode,
		async (candidate) => {
			const searchUrl = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
			searchUrl.searchParams.set("api_key", fdcApiKey);
			searchUrl.searchParams.set("query", candidate);
			searchUrl.searchParams.set("dataType", "Branded");
			searchUrl.searchParams.set("pageSize", "25");
			const search = await fetchJson(searchUrl, `USDA search for ${barcode}`);
			const match = (search?.foods ?? []).find(
				(food) => normalizeBarcode(food.gtinUpc) === canonicalBarcode,
			);
			if (!match?.fdcId) return null;

			const detailUrl = new URL(
				`https://api.nal.usda.gov/fdc/v1/food/${match.fdcId}`,
			);
			detailUrl.searchParams.set("api_key", fdcApiKey);
			const detail = await fetchJson(detailUrl, `USDA detail for ${barcode}`);
			const values = uniqueValues([
				detail?.brandedFoodCategory,
				...getFdcCategoryValues(detail?.foodCategory ?? match.foodCategory),
			]);
			return {
				values,
				observations: values.map((value) => ({
					source: "fdc-branded-detail",
					sourceField:
						detail?.brandedFoodCategory === value
							? "brandedFoodCategory"
							: "foodCategory",
					sourceValue: value,
					sourceReference: String(match.fdcId),
					sourcePayload: {
						fdcId: match.fdcId,
						description: detail?.description ?? match.description ?? null,
						brandOwner: detail?.brandOwner ?? match.brandOwner ?? null,
						brandedFoodCategory: detail?.brandedFoodCategory ?? null,
						foodCategory: detail?.foodCategory ?? match.foodCategory ?? null,
					},
				})),
			};
		},
	);
	return candidateMatch?.value ?? { values: [], observations: [] };
};

const lookupOpenFoodFactsCategories = async (barcode) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return { values: [], observations: [] };
	const candidateMatch = await findFirstBarcodeCandidateMatch(
		barcode,
		async (candidate) => {
			const url = new URL(
				`${OPEN_FOOD_FACTS_URL}/${encodeURIComponent(candidate)}.json`,
			);
			url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
			const payload = await fetchJson(
				url,
				`Open Food Facts lookup for ${barcode}`,
				{
					headers: {
						accept: "application/json",
						"user-agent": APP_USER_AGENT,
					},
				},
			);
			if (payload?.status !== 1 || !payload.product) return null;
			const product = payload.product;
			if (normalizeBarcode(product.code ?? candidate) !== canonicalBarcode)
				return null;
			const fields = [
				["food_groups", splitValues(product.food_groups)],
				["food_groups_tags", product.food_groups_tags ?? []],
				["categories_tags", product.categories_tags ?? []],
				["categories", splitValues(product.categories)],
				["main_category", [product.main_category]],
				["categories_hierarchy", product.categories_hierarchy ?? []],
			];
			const observations = [];
			for (const [sourceField, values] of fields) {
				for (const sourceValue of uniqueValues(values)) {
					observations.push({
						source: "open-food-facts",
						sourceField,
						sourceValue,
						sourceReference: normalizeBarcode(product.code) || barcode,
						sourcePayload: {
							code: product.code ?? null,
							productName: product.product_name ?? null,
							brands: product.brands ?? null,
							[sourceField]: product[sourceField] ?? null,
						},
					});
				}
			}
			return {
				values: uniqueValues([
					...splitValues(product.food_groups),
					...(product.food_groups_tags ?? []),
					...(product.categories_tags ?? []),
					...splitValues(product.categories),
					product.main_category,
					...(product.categories_hierarchy ?? []),
				]),
				observations,
			};
		},
	);
	return candidateMatch?.value ?? { values: [], observations: [] };
};

const readAllActiveProducts = async () => {
	const { data, error } = await supabase
		.from("shared_products")
		.select(
			"id, barcode, product_name, approved_submission_id, category_option_id, food",
		)
		.eq("status", "active")
		.order("barcode");
	if (error) throw error;
	return data ?? [];
};

const readApprovedSubmissions = async (products) => {
	const ids = products
		.map((product) => product.approved_submission_id)
		.filter(Boolean);
	if (!ids.length) return new Map();
	const { data, error } = await supabase
		.from("shared_product_submissions")
		.select("id, food")
		.in("id", ids);
	if (error) throw error;
	return new Map((data ?? []).map((submission) => [submission.id, submission]));
};

const saveCategoryObservations = async (barcode, observations) => {
	if (!observations.length || isDryRun) return;
	const { data: existing, error: existingError } = await supabase
		.from("custom_food_category_observations")
		.select(
			"source, source_field, normalized_value, source_reference, first_seen_at, observation_count",
		)
		.eq("query", barcode);
	if (existingError) throw existingError;
	const existingByKey = new Map(
		(existing ?? []).map((row) => [
			[
				row.source,
				row.source_field,
				row.normalized_value,
				row.source_reference,
			].join("|"),
			row,
		]),
	);
	const now = new Date().toISOString();
	const rows = observations.map((observation) => {
		const normalizedValue = normalizeFoodCategoryValue(observation.sourceValue);
		const existingRow = existingByKey.get(
			[
				observation.source,
				observation.sourceField,
				normalizedValue,
				observation.sourceReference,
			].join("|"),
		);
		return {
			category_id: toFoodCategoryId(normalizedValue),
			label: toFoodCategoryLabel(normalizedValue),
			normalized_value: normalizedValue,
			source: observation.source,
			query: barcode,
			source_field: observation.sourceField,
			source_value: observation.sourceValue,
			source_reference: observation.sourceReference,
			source_payload: observation.sourcePayload,
			observation_count: (existingRow?.observation_count ?? 0) + 1,
			first_seen_at: existingRow?.first_seen_at ?? now,
			last_seen_at: now,
		};
	});
	const { error } = await supabase
		.from("custom_food_category_observations")
		.upsert(rows, {
			onConflict: "source,query,source_field,normalized_value,source_reference",
		});
	if (error) throw error;
};

const rebuildExactMappings = async (normalizedValues) => {
	if (!normalizedValues.length || isDryRun) return;
	const { error: rebuildError } = await supabase.rpc(
		"rebuild_custom_food_category_options",
	);
	if (rebuildError) throw rebuildError;
	const { data: options, error: optionError } = await supabase
		.from("custom_food_category_options")
		.select(
			"id, label, normalized_value, sources, source_count, observation_count, first_seen_at, last_seen_at",
		)
		.in("normalized_value", normalizedValues);
	if (optionError) throw optionError;
	const { data: observations, error: observationError } = await supabase
		.from("custom_food_category_observations")
		.select(
			"normalized_value, source, source_field, source_value, observation_count, first_seen_at, last_seen_at",
		)
		.in("normalized_value", normalizedValues);
	if (observationError) throw observationError;

	const rows = (options ?? []).map((option) => {
		const matching = (observations ?? []).filter(
			(observation) => observation.normalized_value === option.normalized_value,
		);
		return {
			source_normalized_value: option.normalized_value,
			source_value: matching[0]?.source_value ?? option.label,
			source_values: uniqueValues(matching.map((item) => item.source_value)),
			source_fields: [
				...new Set(matching.map((item) => item.source_field)),
			].sort(),
			sources: [...new Set(matching.map((item) => item.source))].sort(),
			category_option_id: option.id,
			category_option_label: option.label,
			confidence: "exact",
			match_reason: "exact_api_observation",
			source_count: option.source_count,
			observation_count: option.observation_count,
			first_seen_at: option.first_seen_at,
			last_seen_at: option.last_seen_at,
		};
	});
	if (!rows.length) return;
	const { error } = await supabase
		.from("custom_food_category_mappings")
		.upsert(rows, { onConflict: "source_normalized_value" });
	if (error) throw error;
};

const resolveCategory = async (sourceValues) => {
	const { data, error } = await supabase.rpc(
		"resolve_custom_food_category_option",
		{ p_source_values: sourceValues },
	);
	if (error) throw error;
	return data?.[0] ?? null;
};

const applyCategory = (food, resolved, sourceValues) => ({
	...food,
	foodCategory: resolved.category_option_label,
	categories: uniqueValues([
		resolved.category_option_label,
		...(food?.categories ?? []),
		...sourceValues,
	]),
});

const updateCatalogRows = async ({
	product,
	submission,
	resolved,
	sourceValues,
}) => {
	if (isDryRun) return;
	const productFood = applyCategory(product.food, resolved, sourceValues);
	const { error: productError } = await supabase
		.from("shared_products")
		.update({
			category_option_id: resolved.category_option_id,
			food: productFood,
		})
		.eq("id", product.id);
	if (productError) throw productError;

	if (submission) {
		const { error: submissionError } = await supabase
			.from("shared_product_submissions")
			.update({
				category_option_id: resolved.category_option_id,
				food: applyCategory(submission.food, resolved, sourceValues),
			})
			.eq("id", submission.id);
		if (submissionError) throw submissionError;
	}

	const { data: revisions, error: revisionReadError } = await supabase
		.from("shared_product_revisions")
		.select("id, food")
		.eq("shared_product_id", product.id);
	if (revisionReadError) throw revisionReadError;
	for (const revision of revisions ?? []) {
		const { error: revisionError } = await supabase
			.from("shared_product_revisions")
			.update({
				category_option_id: resolved.category_option_id,
				food: applyCategory(revision.food, resolved, sourceValues),
			})
			.eq("id", revision.id);
		if (revisionError) throw revisionError;
	}
};

const deleteInvalidCategoryData = async () => {
	if (isDryRun) return;
	const invalidValues = [...INVALID_CATEGORY_VALUES];
	const { error: mappingError } = await supabase
		.from("custom_food_category_mappings")
		.delete()
		.in("source_normalized_value", invalidValues);
	if (mappingError) throw mappingError;
	const { error: observationError } = await supabase
		.from("custom_food_category_observations")
		.delete()
		.in("normalized_value", invalidValues);
	if (observationError) throw observationError;
	const { error: optionError } = await supabase
		.from("custom_food_category_options")
		.delete()
		.in("normalized_value", invalidValues);
	if (optionError) throw optionError;
};

const main = async () => {
	const products = await readAllActiveProducts();
	const submissions = await readApprovedSubmissions(products);
	const audits = [];
	const allObservedValues = [];

	for (const product of products) {
		const submission = submissions.get(product.approved_submission_id);
		const [usda, openFoodFacts] = await Promise.all([
			lookupUsdaCategories(product.barcode),
			lookupOpenFoodFactsCategories(product.barcode),
		]);
		const observations = [...usda.observations, ...openFoodFacts.observations];
		await saveCategoryObservations(product.barcode, observations);
		const submissionValues = submission?.food?.categories ?? [];
		const sourceValues = uniqueValues([
			...openFoodFacts.values,
			...usda.values,
			...submissionValues,
		]);
		allObservedValues.push(...observations.map((item) => item.sourceValue));
		audits.push({ product, submission, sourceValues, usda, openFoodFacts });
	}

	await rebuildExactMappings([
		...new Set(
			allObservedValues.map(normalizeFoodCategoryValue).filter(Boolean),
		),
	]);

	let updated = 0;
	const unresolved = [];
	for (const audit of audits) {
		const resolved = await resolveCategory(audit.sourceValues);
		if (!resolved) {
			unresolved.push(audit.product.barcode);
			continue;
		}
		await updateCatalogRows({ ...audit, resolved });
		updated += 1;
		console.log(
			`${isDryRun ? "Would map" : "Mapped"} ${audit.product.barcode} -> ${resolved.category_option_label}`,
		);
	}
	await deleteInvalidCategoryData();

	console.log(
		JSON.stringify(
			{ scanned: products.length, updated, unresolved, dryRun: isDryRun },
			null,
			2,
		),
	);
};

await main();
