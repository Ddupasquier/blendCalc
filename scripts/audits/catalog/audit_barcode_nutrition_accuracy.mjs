/**
 * Purpose: Audit at least 300 exact product GTINs plus every active shared-catalog
 * product across USDA, Open Food Facts, serving math, nutrient relationships,
 * normalized catalog storage, and field-level evidence. The audit is read-only and
 * writes its detailed local report under the gitignored scripts/output directory.
 * Run: `node scripts/audits/catalog/audit_barcode_nutrition_accuracy.mjs --limit=300`
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
	compareCrossSourceNutrients,
	compareNutrientMaps,
	createNutrientKey,
	createNutrientMap,
	getOpenFoodFactsServingWeightGrams,
	getSourceServingWeightGrams,
	mapOpenFoodFactsPer100Nutrients,
	normalizeAuditUnit,
	valuesAgree,
} from "../../lib/barcode/barcodeNutritionAudit.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const APP_USER_AGENT = createAppUserAgent("barcode nutrition accuracy audit");
const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;
const USDA_BATCH_SIZE = 20;
const USDA_LIST_PAGE_SIZE = 200;
const DEFAULT_OFF_DELAY_MS = 4200;

const parseIntegerArgument = (name, fallback) => {
	const argument = process.argv.find((value) =>
		value.startsWith(`--${name}=`)
	);
	if (!argument) return fallback;
	const value = Number.parseInt(argument.split("=")[1], 10);
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new TypeError(`--${name} must be a positive integer.`);
	}
	return value;
};

const requestedLimit = parseIntegerArgument("limit", DEFAULT_LIMIT);
const auditLimit = Math.min(requestedLimit, MAX_LIMIT);
const offDelayMilliseconds = parseIntegerArgument(
	"off-delay-ms",
	DEFAULT_OFF_DELAY_MS,
);
const skipOpenFoodFacts = process.argv.includes("--skip-open-food-facts");
const reportArgument = process.argv.find((value) =>
	value.startsWith("--report=")
);
const reportPath = reportArgument
	? path.resolve(reportArgument.slice("--report=".length))
	: path.resolve(
			"scripts/output",
			`barcode-nutrition-audit-${new Date().toISOString().replaceAll(":", "-")}.json`,
		);

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const usdaApiKey = process.env.FDC_API_KEY || process.env.VITE_FDC_API_KEY;
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

const sleep = (milliseconds) => new Promise((resolve) => {
	setTimeout(resolve, milliseconds);
});

const trace = {
	usdaRequests: 0,
	openFoodFactsRequests: 0,
	retries: 0,
};

const fetchWithRetry = async (
	url,
	options,
	{ source, allowNotFound = false } = {},
) => {
	const retryableStatuses = new Set([429, 500, 502, 503, 504]);
	for (let attempt = 0; attempt < 5; attempt += 1) {
		if (source === "usda") trace.usdaRequests += 1;
		if (source === "open-food-facts") {
			trace.openFoodFactsRequests += 1;
		}
		let response;
		try {
			response = await fetch(url, options);
		} catch (error) {
			if (attempt === 4) throw error;
			trace.retries += 1;
			await sleep(750 * (2 ** attempt));
			continue;
		}
		if (response.ok || (allowNotFound && response.status === 404)) {
			return response;
		}
		if (!retryableStatuses.has(response.status) || attempt === 4) {
			throw new Error(`${url} returned ${response.status}.`);
		}
		trace.retries += 1;
		const retryAfter = Number(response.headers.get("retry-after"));
		await sleep(
			Number.isFinite(retryAfter) && retryAfter > 0
				? retryAfter * 1000
				: 750 * (2 ** attempt),
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
	const [definitions, rawMappings, conversions, equivalences, sources] =
		await Promise.all([
			queryAll(
				"nutrient_definitions",
				"nutrient_id,nutrient_name,nutrient_number,default_unit_name",
			),
			queryAll(
				"nutrient_source_mappings",
				"source_key,source_nutrient_key,source_unit_name,source_nutrient_name,nutrient_id,priority,mapping_method,review_status,review_reference,enabled,confidence",
			),
			queryAll(
				"nutrient_unit_conversions",
				"source_key,nutrient_id,from_unit_name,to_unit_name,multiplier,conversion_method,confidence,observation_count,provenance",
			),
			queryAll(
				"nutrient_equivalences",
				"source_key,source_nutrient_id,source_nutrient_number,canonical_nutrient_id,relation,enabled,source_reference",
				(query) => query.eq("enabled", true),
			),
			queryAll(
				"product_data_sources",
				"key,canonical_storage_allowed,canonical_license_name,canonical_policy_reviewed_at,canonical_policy_notes",
			),
		]);
	const definitionsById = new Map(
		definitions.map((definition) => [
			Number(definition.nutrient_id),
			definition,
		]),
	);
	const mappings = rawMappings.map((mapping) => {
		const definition = definitionsById.get(Number(mapping.nutrient_id));
		return {
			...mapping,
			nutrient_name:
				definition?.nutrient_name ??
				mapping.source_nutrient_name ??
				String(mapping.nutrient_id),
			nutrient_number: definition?.nutrient_number ?? "",
			default_unit_name:
				definition?.default_unit_name ?? mapping.source_unit_name,
		};
	});
	return { definitions, mappings, conversions, equivalences, sources };
};

const loadCatalogData = async () => {
	const sharedProducts = await queryAll(
		"shared_products",
		"id,barcode,product_name,brand_owner,food,source,source_reference,status,canonical_provenance,last_verified_at",
		(query) => query.eq("status", "active").order("barcode"),
	);
	const sharedProductIds = sharedProducts.map((product) => product.id);
	if (sharedProductIds.length === 0) {
		return {
			sharedProducts,
			foodNutrients: [],
			foodServings: [],
			fieldProvenance: [],
			observations: [],
			conflicts: [],
		};
	}

	const [
		foodNutrients,
		foodServings,
		fieldProvenance,
		observations,
		conflicts,
	] =
		await Promise.all([
			queryAll(
				"food_nutrients",
				"id,shared_product_id,nutrient_id,amount_per_100g,unit_name,value_origin,source,source_reference,confidence,source_observation_id,shared_product_observation_id",
				(query) => query.in("shared_product_id", sharedProductIds),
			),
			queryAll(
				"food_servings",
				"id,shared_product_id,label,gram_weight,amount,unit_key,is_primary,serving_order,source,source_reference,confidence,source_observation_id,shared_product_observation_id",
				(query) => query.in("shared_product_id", sharedProductIds),
			),
			queryAll(
				"shared_product_field_provenance",
				"id,shared_product_id,observation_id,field_path,normalized_value,selected,confidence,verification_method",
				(query) => query.in("shared_product_id", sharedProductIds),
			),
			queryAll(
				"shared_product_observations",
				"id,barcode,source,source_reference,source_license,raw_payload,normalized_food,observed_at",
			),
			queryAll(
				"shared_product_conflicts",
				"id,shared_product_id,barcode,field_path,observed_values,severity,status,created_at",
				(query) => query.in("shared_product_id", sharedProductIds),
			),
		]);

	return {
		sharedProducts,
		foodNutrients,
		foodServings,
		fieldProvenance,
		observations,
		conflicts,
	};
};

const fetchUsdaListPage = async (pageNumber) => {
	const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/list");
	url.searchParams.set("api_key", usdaApiKey);
	const response = await fetchWithRetry(url, {
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
	}, { source: "usda" });
	return response.json();
};

const sourceDate = (food) => Date.parse(
	food?.publicationDate ||
	food?.publishedDate ||
	food?.modifiedDate ||
	food?.availableDate ||
	"",
) || 0;

const selectNewestUsdaTarget = (current, candidate) => {
	if (!current) return candidate;
	const currentDiscontinued = Boolean(current.listFood?.discontinuedDate);
	const candidateDiscontinued = Boolean(candidate.listFood?.discontinuedDate);
	if (currentDiscontinued !== candidateDiscontinued) {
		return currentDiscontinued ? candidate : current;
	}
	const dateDifference =
		sourceDate(candidate.listFood) - sourceDate(current.listFood);
	if (dateDifference !== 0) return dateDifference > 0 ? candidate : current;
	return Number(candidate.fdcId) > Number(current.fdcId)
		? candidate
		: current;
};

const buildAuditTargets = async (catalogData) => {
	const targets = new Map();
	for (const product of catalogData.sharedProducts) {
		const barcode = normalizeBarcode(product.barcode);
		if (!barcode) continue;
		const food = product.food ?? {};
		const sourceKey = food.sourceKey ?? product.source;
		const sourceReference = String(
			food.sourceIdentifiers?.usdaFdcId ??
			product.source_reference ??
			"",
		).trim();
		targets.set(barcode, {
			barcode,
			sharedProductId: product.id,
			sharedProductName: product.product_name,
			sharedSourceKey: sourceKey,
			fdcId:
				sourceKey === "usda" &&
				Number.isSafeInteger(Number(sourceReference)) &&
				Number(sourceReference) > 0
					? Number(sourceReference)
					: null,
			listFood: null,
		});
	}

	let pageNumber = 1;
	let exhausted = false;
	while (targets.size < auditLimit && !exhausted) {
		const foods = await fetchUsdaListPage(pageNumber);
		if (!Array.isArray(foods) || foods.length === 0) {
			exhausted = true;
			break;
		}
		for (const food of foods) {
			const barcode = normalizeBarcode(food.gtinUpc);
			const fdcId = Number(food.fdcId);
			if (
				!barcode ||
				!Number.isSafeInteger(fdcId) ||
				fdcId <= 0 ||
				food.dataType !== "Branded"
			) {
				continue;
			}
			const candidate = {
				barcode,
				fdcId,
				listFood: food,
				sharedProductId: targets.get(barcode)?.sharedProductId ?? null,
				sharedProductName: targets.get(barcode)?.sharedProductName ?? null,
				sharedSourceKey: targets.get(barcode)?.sharedSourceKey ?? null,
			};
			targets.set(
				barcode,
				selectNewestUsdaTarget(targets.get(barcode), candidate),
			);
			if (targets.size >= auditLimit) break;
		}
		pageNumber += 1;
	}
	if (targets.size < auditLimit) {
		throw new Error(
			`USDA list ended after ${targets.size} unique exact GTINs; ${auditLimit} were required.`,
		);
	}
	return [...targets.values()].slice(0, auditLimit);
};

const chunk = (values, size) => {
	const groups = [];
	for (let index = 0; index < values.length; index += size) {
		groups.push(values.slice(index, index + size));
	}
	return groups;
};

const fetchUsdaDetails = async (targets) => {
	const fdcIds = [...new Set(
		targets.map((target) => target.fdcId).filter((value) =>
			Number.isSafeInteger(value) && value > 0
		),
	)];
	const foodsByFdcId = new Map();
	for (const fdcIdBatch of chunk(fdcIds, USDA_BATCH_SIZE)) {
		const url = new URL("https://api.nal.usda.gov/fdc/v1/foods");
		url.searchParams.set("api_key", usdaApiKey);
		const response = await fetchWithRetry(url, {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
			},
			body: JSON.stringify({ fdcIds: fdcIdBatch, format: "full" }),
		}, { source: "usda" });
		const foods = await response.json();
		for (const food of foods ?? []) {
			foodsByFdcId.set(Number(food.fdcId), food);
		}
	}
	return foodsByFdcId;
};

const OPEN_FOOD_FACTS_FIELDS = [
	"code",
	"product_name",
	"serving_size",
	"serving_quantity",
	"serving_quantity_unit",
	"nutriments",
	"last_modified_t",
].join(",");

const fetchOpenFoodFactsProduct = async (barcode) => {
	const candidate = getBarcodeLookupCandidates(barcode)[0];
	if (!candidate) return null;
	const url = new URL(
		`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json`,
	);
	url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS);
	const response = await fetchWithRetry(url, {
		headers: {
			accept: "application/json",
			"user-agent": APP_USER_AGENT,
		},
	}, { source: "open-food-facts", allowNotFound: true });
	if (response.status === 404) return null;
	const payload = await response.json();
	if (payload.status !== 1 || !payload.product) return null;
	const productBarcode = normalizeBarcode(
		payload.product.code ?? candidate,
	);
	return productBarcode === barcode ? payload.product : null;
};

const fetchOpenFoodFactsProducts = async (targets) => {
	const productsByBarcode = new Map();
	if (skipOpenFoodFacts) return productsByBarcode;
	const sharedCatalogTargets = targets.filter((target) =>
		Boolean(target.sharedProductId)
	);
	let completed = 0;
	for (const target of sharedCatalogTargets) {
		const product = await fetchOpenFoodFactsProduct(target.barcode);
		if (product) productsByBarcode.set(target.barcode, product);
		completed += 1;
		console.log(
			`Open Food Facts shared-catalog checks: ${completed}/${sharedCatalogTargets.length}`,
		);
		if (completed < sharedCatalogTargets.length) {
			await sleep(offDelayMilliseconds);
		}
	}
	return productsByBarcode;
};

const addIssue = (issues, type, details) => {
	issues.push({ type, ...details });
};

const auditSourceProducts = ({
	targets,
	usdaDetails,
	openFoodFactsProducts,
	referenceData,
}) => {
	const productAudits = new Map();
	const issues = {
		applicationMath: [],
		sourceData: [],
		crossSourceConflicts: [],
	};
	const counters = {
		usdaProducts: 0,
		openFoodFactsProducts: 0,
		usdaNutrients: 0,
		openFoodFactsNutrients: 0,
		roundTripChecks: 0,
		usdaLabelChecks: 0,
		openFoodFactsServingChecks: 0,
		crossSourceComparisons: 0,
	};

	for (const target of targets) {
		const productAudit = {
			barcode: target.barcode,
			fdcId: target.fdcId,
			usdaNutrientMap: new Map(),
			openFoodFactsNutrientMap: new Map(),
		};
		const usdaFood = usdaDetails.get(target.fdcId);
		if (usdaFood) {
			counters.usdaProducts += 1;
			const detailBarcode = normalizeBarcode(usdaFood.gtinUpc);
			if (detailBarcode !== target.barcode) {
				addIssue(issues.sourceData, "usda-barcode-mismatch", {
					barcode: target.barcode,
					fdcId: target.fdcId,
					sourceBarcode: usdaFood.gtinUpc ?? null,
				});
			}
			const canonicalNutrients = canonicalizeUsdaNutrients(
				usdaFood,
				referenceData,
			);
			const {
				nutrientMap: usdaNutrientMap,
				duplicates,
			} = createNutrientMap(canonicalNutrients);
			productAudit.usdaNutrientMap = usdaNutrientMap;
			productAudit.usdaFood = usdaFood;
			counters.usdaNutrients += usdaNutrientMap.size;
			for (const duplicate of duplicates) {
				addIssue(issues.applicationMath, "usda-canonical-duplicate", {
					barcode: target.barcode,
					fdcId: target.fdcId,
					nutrientKey: duplicate,
				});
			}

			const servingWeight = getSourceServingWeightGrams(usdaFood) ?? 100;
			const roundTrip = auditPer100ServingRoundTrip(
				[...usdaNutrientMap.values()],
				servingWeight,
			);
			counters.roundTripChecks += roundTrip.checked;
			for (const mismatch of roundTrip.mismatched) {
				addIssue(issues.applicationMath, "usda-serving-round-trip", {
					barcode: target.barcode,
					fdcId: target.fdcId,
					...mismatch,
				});
			}

			if (target.listFood) {
				const listNutrients = createNutrientMap(
					canonicalizeUsdaNutrients(target.listFood, referenceData),
				).nutrientMap;
				const listComparison = compareNutrientMaps({
					expected: listNutrients,
					actual: usdaNutrientMap,
				});
				for (const mismatch of listComparison.mismatched) {
					addIssue(issues.sourceData, "usda-list-detail-mismatch", {
						barcode: target.barcode,
						fdcId: target.fdcId,
						...mismatch,
					});
				}
				for (const nutrientKey of listComparison.missing) {
					addIssue(issues.sourceData, "usda-list-nutrient-missing-detail", {
						barcode: target.barcode,
						fdcId: target.fdcId,
						nutrientKey,
					});
				}
			}

			const labelAudit = auditUsdaLabelConsistency(
				usdaFood,
				usdaNutrientMap,
			);
			counters.usdaLabelChecks += labelAudit.checked;
			for (const mismatch of labelAudit.mismatched) {
				addIssue(issues.sourceData, "usda-label-basis-mismatch", {
					barcode: target.barcode,
					fdcId: target.fdcId,
					...mismatch,
				});
			}
			for (const missing of labelAudit.missingPer100) {
				addIssue(issues.sourceData, "usda-label-nutrient-missing-per100", {
					barcode: target.barcode,
					fdcId: target.fdcId,
					...missing,
				});
			}
			for (const relationship of auditNutrientRelationships(
				usdaNutrientMap,
			)) {
				addIssue(issues.sourceData, "usda-nutrient-relationship", {
					barcode: target.barcode,
					fdcId: target.fdcId,
					...relationship,
				});
			}
		} else if (target.fdcId) {
			addIssue(issues.sourceData, "usda-detail-missing", {
				barcode: target.barcode,
				fdcId: target.fdcId,
			});
		}

		const offProduct = openFoodFactsProducts.get(target.barcode);
		if (offProduct) {
			counters.openFoodFactsProducts += 1;
			const offNutrients = mapOpenFoodFactsPer100Nutrients(
				offProduct,
				referenceData,
			);
			const {
				nutrientMap: offNutrientMap,
				duplicates,
			} = createNutrientMap(offNutrients);
			productAudit.openFoodFactsNutrientMap = offNutrientMap;
			productAudit.openFoodFactsProduct = offProduct;
			counters.openFoodFactsNutrients += offNutrientMap.size;
			for (const duplicate of duplicates) {
				addIssue(issues.applicationMath, "off-canonical-duplicate", {
					barcode: target.barcode,
					nutrientKey: duplicate,
				});
			}

			const servingAudit = auditOpenFoodFactsServingBasis(
				offProduct,
				referenceData,
			);
			counters.openFoodFactsServingChecks += servingAudit.checked;
			for (const mismatch of servingAudit.mismatched) {
				addIssue(issues.sourceData, "off-serving-basis-mismatch", {
					barcode: target.barcode,
					...mismatch,
				});
			}

			const servingWeight =
				getOpenFoodFactsServingWeightGrams(offProduct) ?? 100;
			const roundTrip = auditPer100ServingRoundTrip(
				[...offNutrientMap.values()],
				servingWeight,
			);
			counters.roundTripChecks += roundTrip.checked;
			for (const mismatch of roundTrip.mismatched) {
				addIssue(issues.applicationMath, "off-serving-round-trip", {
					barcode: target.barcode,
					...mismatch,
				});
			}
			for (const relationship of auditNutrientRelationships(
				offNutrientMap,
			)) {
				addIssue(issues.sourceData, "off-nutrient-relationship", {
					barcode: target.barcode,
					...relationship,
				});
			}
		}

		if (
			productAudit.usdaNutrientMap.size > 0 &&
			productAudit.openFoodFactsNutrientMap.size > 0
		) {
			const crossSource = compareCrossSourceNutrients(
				productAudit.usdaNutrientMap,
				productAudit.openFoodFactsNutrientMap,
			);
			counters.crossSourceComparisons += crossSource.compared.length;
			for (const conflict of crossSource.conflicts) {
				addIssue(
					issues.crossSourceConflicts,
					"usda-off-nutrient-conflict",
					{ barcode: target.barcode, ...conflict },
				);
			}
		}

		productAudits.set(target.barcode, productAudit);
	}

	return { productAudits, issues, counters };
};

const groupBy = (rows, key) => {
	const grouped = new Map();
	for (const row of rows) {
		const value = row[key];
		const group = grouped.get(value) ?? [];
		group.push(row);
		grouped.set(value, group);
	}
	return grouped;
};

const auditSharedCatalog = ({
	catalogData,
	productAudits,
	referenceData,
}) => {
	const issues = [];
	const backfillCandidates = [];
	const policyBlockedBackfillCandidates = [];
	const nutrientsByProduct = groupBy(
		catalogData.foodNutrients,
		"shared_product_id",
	);
	const servingsByProduct = groupBy(
		catalogData.foodServings,
		"shared_product_id",
	);
	const provenanceByProduct = groupBy(
		catalogData.fieldProvenance,
		"shared_product_id",
	);
	const conflictsByProduct = groupBy(
		catalogData.conflicts,
		"shared_product_id",
	);
	const observationsById = new Map(
		catalogData.observations.map((observation) => [
			observation.id,
			observation,
		]),
	);
	const definitionsById = new Map(
		referenceData.definitions.map((definition) => [
			Number(definition.nutrient_id),
			definition,
		]),
	);
	const sourcePolicyByKey = new Map(
		referenceData.sources.map((source) => [source.key, source]),
	);
	const counters = {
		products: catalogData.sharedProducts.length,
		nutrients: catalogData.foodNutrients.length,
		servings: catalogData.foodServings.length,
		conflicts: catalogData.conflicts.length,
		sourceComparisons: 0,
		jsonComparisons: 0,
	};

	for (const product of catalogData.sharedProducts) {
		const barcode = normalizeBarcode(product.barcode);
		const audit = productAudits.get(barcode);
		const food = product.food ?? {};
		const normalizedRows = nutrientsByProduct.get(product.id) ?? [];
		const normalizedMap = createNutrientMap(normalizedRows).nutrientMap;
		const jsonMap = createNutrientMap(food.foodNutrients ?? []).nutrientMap;
		const jsonComparison = compareNutrientMaps({
			expected: normalizedMap,
			actual: jsonMap,
			absoluteTolerance: 0.000001,
			relativeTolerance: 0.000001,
		});
		counters.jsonComparisons += normalizedMap.size;
		for (const mismatch of jsonComparison.mismatched) {
			addIssue(issues, "catalog-json-normalized-mismatch", {
				sharedProductId: product.id,
				barcode,
				...mismatch,
			});
		}
		for (const nutrientKey of jsonComparison.missing) {
			addIssue(issues, "catalog-json-missing-normalized-nutrient", {
				sharedProductId: product.id,
				barcode,
				nutrientKey,
			});
		}
		for (const nutrientKey of jsonComparison.unexpected) {
			addIssue(issues, "catalog-normalized-missing-json-nutrient", {
				sharedProductId: product.id,
				barcode,
				nutrientKey,
			});
		}

		for (const row of normalizedRows) {
			const definition = definitionsById.get(Number(row.nutrient_id));
			if (
				definition &&
				normalizeAuditUnit(definition.default_unit_name) !==
					normalizeAuditUnit(row.unit_name)
			) {
				addIssue(issues, "catalog-canonical-unit-mismatch", {
					sharedProductId: product.id,
					barcode,
					nutrientId: row.nutrient_id,
					storedUnit: row.unit_name,
					canonicalUnit: definition.default_unit_name,
				});
			}
			const observationId =
				row.source_observation_id ??
				row.shared_product_observation_id;
			if (!observationId || !observationsById.has(observationId)) {
				addIssue(issues, "catalog-nutrient-missing-observation", {
					sharedProductId: product.id,
					barcode,
					nutrientId: row.nutrient_id,
					value: row.amount_per_100g,
					valueOrigin: row.value_origin,
					source: row.source,
				});
			}
			if (
				Number(row.amount_per_100g) === 0 &&
				row.value_origin !== "reported"
			) {
				addIssue(issues, "catalog-unreported-zero", {
					sharedProductId: product.id,
					barcode,
					nutrientId: row.nutrient_id,
					valueOrigin: row.value_origin,
					source: row.source,
				});
			}
		}

		const sourceKey = food.sourceKey ?? product.source;
		const sourceMap = sourceKey === "usda"
			? audit?.usdaNutrientMap
			: sourceKey === "open-food-facts"
				? audit?.openFoodFactsNutrientMap
				: null;
		if (sourceMap?.size) {
			const sourceComparison = compareNutrientMaps({
				expected: sourceMap,
				actual: normalizedMap,
			});
			counters.sourceComparisons += sourceMap.size;
			for (const mismatch of sourceComparison.mismatched) {
				addIssue(issues, "catalog-source-nutrient-mismatch", {
					sharedProductId: product.id,
					barcode,
					sourceKey,
					...mismatch,
				});
			}
			for (const nutrientKey of sourceComparison.missing) {
				const sourceNutrient = sourceMap.get(nutrientKey);
				const sourcePolicy = sourcePolicyByKey.get(sourceKey);
				const candidate = {
					type: "missing-canonical-source-nutrient",
					sharedProductId: product.id,
					barcode,
					sourceKey,
					sourceReference:
						sourceKey === "usda"
							? String(audit?.fdcId ?? product.source_reference ?? "")
							: barcode,
					nutrientKey,
					nutrientId: sourceNutrient?.nutrientId,
					unitName: sourceNutrient?.unitName,
					value: sourceNutrient?.value,
					canonicalStorageAllowed: Boolean(
						sourcePolicy?.canonical_storage_allowed,
					),
					canonicalLicenseName:
						sourcePolicy?.canonical_license_name ?? null,
					policyReviewedAt:
						sourcePolicy?.canonical_policy_reviewed_at ?? null,
					policyNotes:
						sourcePolicy?.canonical_policy_notes ?? null,
				};
				if (candidate.canonicalStorageAllowed) {
					backfillCandidates.push(candidate);
					addIssue(
						issues,
						"catalog-source-nutrient-missing",
						candidate,
					);
				} else {
					policyBlockedBackfillCandidates.push(candidate);
				}
			}
		}

		if (
			audit?.usdaNutrientMap?.size &&
			audit?.openFoodFactsNutrientMap?.size
		) {
			const trackedConflictFields = new Set(
				(conflictsByProduct.get(product.id) ?? [])
					.filter((conflict) => conflict.status === "open")
					.map((conflict) => conflict.field_path),
			);
			const crossSource = compareCrossSourceNutrients(
				audit.usdaNutrientMap,
				audit.openFoodFactsNutrientMap,
			);
			for (const conflict of crossSource.conflicts) {
				const nutrientId = Number(conflict.key.split(":")[0]);
				const fieldPath = `nutrient:${nutrientId}`;
				if (!trackedConflictFields.has(fieldPath)) {
					addIssue(
						issues,
						"catalog-cross-source-conflict-untracked",
						{
							sharedProductId: product.id,
							barcode,
							fieldPath,
							...conflict,
						},
					);
				}
			}
		}

		const reportedIds = new Set(
			(food.reportedNutrientIds ?? []).map(Number),
		);
		for (const row of normalizedRows) {
			const shouldBeReported = row.value_origin === "reported";
			if (reportedIds.has(Number(row.nutrient_id)) !== shouldBeReported) {
				addIssue(issues, "catalog-reported-state-mismatch", {
					sharedProductId: product.id,
					barcode,
					nutrientId: row.nutrient_id,
					valueOrigin: row.value_origin,
					listedAsReported: reportedIds.has(Number(row.nutrient_id)),
				});
			}
		}

		const selectedProvenance = (
			provenanceByProduct.get(product.id) ?? []
		).filter((entry) => entry.selected);
		for (const row of normalizedRows) {
			const nutrientFieldPath = `nutrient:${row.nutrient_id}`;
			if (!selectedProvenance.some((entry) =>
				entry.field_path === nutrientFieldPath
			)) {
				addIssue(issues, "catalog-nutrient-missing-field-provenance", {
					sharedProductId: product.id,
					barcode,
					nutrientId: row.nutrient_id,
				});
			}
		}

		const primaryServing = (
			servingsByProduct.get(product.id) ?? []
		).find((serving) => serving.is_primary);
		if (!primaryServing) {
			addIssue(issues, "catalog-primary-serving-missing", {
				sharedProductId: product.id,
				barcode,
			});
		} else {
			const sourceServingWeight = sourceKey === "usda"
				? getSourceServingWeightGrams(audit?.usdaFood)
				: sourceKey === "open-food-facts"
					? getOpenFoodFactsServingWeightGrams(
							audit?.openFoodFactsProduct,
						)
					: null;
			if (
				sourceServingWeight !== null &&
				!valuesAgree(
					primaryServing.gram_weight,
					sourceServingWeight,
					{ absoluteTolerance: 0.01, relativeTolerance: 0.001 },
				)
			) {
				addIssue(issues, "catalog-source-serving-mismatch", {
					sharedProductId: product.id,
					barcode,
					sourceKey,
					storedGramWeight: primaryServing.gram_weight,
					sourceGramWeight: sourceServingWeight,
				});
			}
			const servingObservationId =
				primaryServing.source_observation_id ??
				primaryServing.shared_product_observation_id;
			if (
				!servingObservationId ||
				!observationsById.has(servingObservationId)
			) {
				addIssue(issues, "catalog-serving-missing-observation", {
					sharedProductId: product.id,
					barcode,
					servingId: primaryServing.id,
				});
			}
		}
	}

	return {
		issues,
		backfillCandidates,
		policyBlockedBackfillCandidates,
		counters,
	};
};

const createTypeCounts = (issues) =>
	Object.fromEntries(
		[...issues.reduce((counts, issue) => {
			counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
			return counts;
		}, new Map())].sort((left, right) =>
			left[0].localeCompare(right[0])
		),
	);

console.log("Loading reference data and active shared catalog...");
const [referenceData, catalogData] = await Promise.all([
	loadReferenceData(),
	loadCatalogData(),
]);

console.log(
	`Building a deterministic sample of ${auditLimit} unique exact GTINs, including all ${catalogData.sharedProducts.length} active shared products...`,
);
const targets = await buildAuditTargets(catalogData);
console.log("Fetching USDA product details in bounded batches...");
const usdaDetails = await fetchUsdaDetails(targets);
const openFoodFactsProducts = await fetchOpenFoodFactsProducts(targets);

console.log("Running four-layer nutrient and catalog checks...");
const sourceAudit = auditSourceProducts({
	targets,
	usdaDetails,
	openFoodFactsProducts,
	referenceData,
});
const catalogAudit = auditSharedCatalog({
	catalogData,
	productAudits: sourceAudit.productAudits,
	referenceData,
});

const unsafeConversions = referenceData.conversions.filter((conversion) =>
	conversion.conversion_method === "api_observed_ratio"
);
const report = {
	generatedAt: new Date().toISOString(),
	scope: {
		requestedUniqueBarcodes: requestedLimit,
		auditedUniqueBarcodes: targets.length,
		activeSharedProducts: catalogData.sharedProducts.length,
		openFoodFactsChecked: !skipOpenFoodFacts,
	},
	requests: trace,
	referenceData: {
		definitions: referenceData.definitions.length,
		approvedMappings: referenceData.mappings.filter((mapping) =>
			mapping.enabled && mapping.review_status === "approved"
		).length,
		conversions: referenceData.conversions.length,
		equivalences: referenceData.equivalences.length,
		sourcePolicies: referenceData.sources,
		unsafeObservedConversions: unsafeConversions,
	},
	sourceChecks: sourceAudit.counters,
	catalogChecks: catalogAudit.counters,
	issueCounts: {
		applicationMath: createTypeCounts(sourceAudit.issues.applicationMath),
		sourceData: createTypeCounts(sourceAudit.issues.sourceData),
		crossSourceConflicts: createTypeCounts(
			sourceAudit.issues.crossSourceConflicts,
		),
		sharedCatalog: createTypeCounts(catalogAudit.issues),
	},
	issues: {
		...sourceAudit.issues,
		sharedCatalog: catalogAudit.issues,
	},
	backfillCandidates: catalogAudit.backfillCandidates,
	policyBlockedBackfillCandidates:
		catalogAudit.policyBlockedBackfillCandidates,
	auditedProducts: targets.map((target) => ({
		barcode: target.barcode,
		fdcId: target.fdcId,
		sharedProductId: target.sharedProductId,
		sharedProductName: target.sharedProductName,
		usdaMatched: sourceAudit.productAudits.get(target.barcode)
			?.usdaNutrientMap.size > 0,
		openFoodFactsMatched: sourceAudit.productAudits.get(target.barcode)
			?.openFoodFactsNutrientMap.size > 0,
	})),
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("\nBarcode nutrition audit complete.");
console.log(JSON.stringify({
	reportPath,
	scope: report.scope,
	requests: report.requests,
	sourceChecks: report.sourceChecks,
	catalogChecks: report.catalogChecks,
	issueCounts: report.issueCounts,
	backfillCandidates: report.backfillCandidates.length,
	policyBlockedBackfillCandidates:
		report.policyBlockedBackfillCandidates.length,
	unsafeObservedConversions: unsafeConversions.length,
}, null, 2));

if (
	sourceAudit.issues.applicationMath.length > 0 ||
	catalogAudit.issues.some((issue) =>
		[
			"catalog-json-normalized-mismatch",
			"catalog-json-missing-normalized-nutrient",
			"catalog-normalized-missing-json-nutrient",
			"catalog-canonical-unit-mismatch",
			"catalog-source-nutrient-mismatch",
			"catalog-reported-state-mismatch",
			"catalog-cross-source-conflict-untracked",
		].includes(issue.type)
	) ||
	unsafeConversions.length > 0
) {
	process.exitCode = 1;
}
