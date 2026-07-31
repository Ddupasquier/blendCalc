/**
 * Purpose: Report population, representative values, semantic ownership, API exposure,
 * and app-read status for catalog verification, history, provenance, exact-product
 * evidence coverage, ingredient analysis, servings, nutrient uncertainty, and
 * compatibility evidence.
 * This script is read-only and does not write database rows or local output files.
 * Run: `node scripts/audits/audit_catalog_transparency.mjs`
 * JSON: `node scripts/audits/audit_catalog_transparency.mjs --json`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";
import WebSocket from "ws";
import {
	CATALOG_TRANSPARENCY_SEMANTICS,
	createCoverageRow,
	hasSourceQualityMetadata,
	hasStructuredIngredientAnalysis,
} from "../lib/catalogTransparency.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jsonOutput = process.argv.includes("--json");
const sampleLimitArgument = process.argv.find((argument) =>
	argument.startsWith("--samples=")
);
const sampleLimit = Math.max(
	1,
	Math.min(10, Number(sampleLimitArgument?.split("=")[1] ?? 3) || 3),
);

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

const readCount = async (label, request) => {
	const { count, error } = await request;
	if (error) throw new Error(`${label}: ${error.message}`);
	return count ?? 0;
};

const uniqueCount = (rows, key) =>
	new Set(rows.map((row) => row[key]).filter(Boolean)).size;

const sample = (values) =>
	[...new Set(values.filter(Boolean))].slice(0, sampleLimit);

const describeProduct = (product, suffix) =>
	`${product.product_name} (${product.barcode})${suffix ? ` — ${suffix}` : ""}`;

const readObservation = (row) =>
	Array.isArray(row.shared_product_observations)
		? row.shared_product_observations[0]
		: row.shared_product_observations;

const readRuntimeLayers = async (productsToRead) => {
	const vite = await createServer({
		appType: "custom",
		logLevel: "silent",
		server: { middlewareMode: true },
	});
	try {
		const [
			{ readApiV1ProductByBarcode },
			{ getApprovedCatalogRecordByBarcode },
			{ getProductInformation },
		] = await Promise.all([
			vite.ssrLoadModule(
				"/src/lib/server/api/v1/catalogApi.server.ts",
			),
			vite.ssrLoadModule(
				"/src/lib/server/products/catalogRead.server.ts",
			),
			vite.ssrLoadModule(
				"/src/lib/utils/food/records/productInformation.ts",
			),
		]);
		return Promise.all(
			productsToRead.map(async (product) => {
				const [apiProduct, appRecord] = await Promise.all([
					readApiV1ProductByBarcode(supabase, product.barcode),
					getApprovedCatalogRecordByBarcode(
						supabase,
						product.barcode,
					),
				]);
				return {
					product,
					apiProduct,
					appRecord,
					appInformation: appRecord
						? getProductInformation(appRecord.food)
						: null,
				};
			}),
		);
	} finally {
		await vite.close();
	}
};

const [
	products,
	revisions,
	revisionChanges,
	productUpdateSubmissions,
	provenance,
	nutrients,
	servings,
	readiness,
	policyVersions,
	compatibilityFacts,
	genericNutrientTotal,
	genericNutrientStandardError,
	genericNutrientSourceCode,
	genericNutrientCanonical,
	genericNutrientSamples,
] = await Promise.all([
	readRows(
		"Active shared products",
		supabase
			.from("shared_products")
			.select(
				"id, barcode, product_name, food, last_verified_at, updated_at",
			)
			.eq("status", "active")
			.order("product_name"),
	),
	readRows(
		"Shared product revisions",
		supabase
			.from("shared_product_revisions")
			.select(
				"id, shared_product_id, revision_number, created_at, label_observed_at, source, source_reference",
			)
			.order("created_at", { ascending: false }),
	),
	readRows(
		"Shared product revision changes",
		supabase
			.from("shared_product_revision_changes")
			.select(
				"id, revision_id, field_path, field_label, change_type, severity, created_at",
			)
			.order("created_at", { ascending: false }),
	),
	readRows(
		"Product update submissions",
		supabase
			.from("shared_product_submissions")
			.select(
				"id, target_shared_product_id, base_revision_id, status, change_summary, label_observed_at",
			)
			.eq("submission_kind", "product_update"),
	),
	readRows(
		"Selected field provenance",
		supabase
			.from("shared_product_field_provenance")
			.select(
				"shared_product_id, field_path, confidence, verification_method, observation_id, shared_product_observations(source, source_reference, observed_at, normalized_food)",
			)
			.eq("selected", true),
	),
	readRows(
		"Normalized catalog nutrients",
		supabase
			.from("food_nutrients")
			.select(
				"shared_product_id, nutrient_id, source, source_reference, confidence, value_origin, shared_product_observation_id, shared_product_revision_id",
			)
			.not("shared_product_id", "is", null),
	),
	readRows(
		"Normalized catalog servings",
		supabase
			.from("food_servings")
			.select(
				"shared_product_id, label, gram_weight, source, source_reference, confidence, shared_product_observation_id, shared_product_revision_id",
			)
			.not("shared_product_id", "is", null),
	),
	readRows(
		"API v1 readiness",
		supabase
			.from("blendcalc_api_v1_product_readiness")
			.select("shared_product_id, publishable, reasons"),
	),
	readRows(
		"Compatibility policy versions",
		supabase
			.from("food_compatibility_policy_versions")
			.select(
				"id, version_number, status, effective_at, reviewed_at, match_rule_snapshot, conflict_rule_snapshot, source_references",
			)
			.order("version_number", { ascending: false }),
	),
	readRows(
		"Product compatibility facts",
		supabase
			.from("product_compatibility_facts")
			.select(
				"id, shared_product_id, shared_product_observation_id, policy_version_id, fact_type, source_type, source_text, confidence, tag_id",
			),
	),
	readCount(
		"Generic nutrient total",
		supabase
			.from("generic_food_nutrients")
			.select("*", { count: "exact", head: true }),
	),
	readCount(
		"Generic nutrients with standard error",
		supabase
			.from("generic_food_nutrients")
			.select("*", { count: "exact", head: true })
			.not("standard_error", "is", null),
	),
	readCount(
		"Generic nutrients with source code",
		supabase
			.from("generic_food_nutrients")
			.select("*", { count: "exact", head: true })
			.not("nutrient_source_code", "is", null),
	),
	readCount(
		"Canonical generic nutrient mappings",
		supabase
			.from("generic_food_nutrients")
			.select("*", { count: "exact", head: true })
			.eq("mapping_status", "canonical"),
	),
	readRows(
		"Generic nutrient uncertainty samples",
		supabase
			.from("generic_food_nutrients")
			.select(
				"dataset_key, source_food_key, source_nutrient_name, amount_per_100g, unit_name, standard_error, observation_count, nutrient_source_code, mapping_status, value_status",
			)
			.not("standard_error", "is", null)
			.limit(sampleLimit),
	),
]);

const productById = new Map(products.map((product) => [product.id, product]));
const apiReadyProductIds = new Set(
	readiness
		.filter((row) => row.publishable)
		.map((row) => row.shared_product_id),
);
const runtimeLayers = await readRuntimeLayers(
	products.filter((product) => apiReadyProductIds.has(product.id)),
);
const apiProducts = runtimeLayers
	.map((layer) => layer.apiProduct)
	.filter(Boolean);
const appRecords = runtimeLayers
	.map((layer) => layer.appRecord)
	.filter(Boolean);
const appInformation = runtimeLayers
	.map((layer) => layer.appInformation)
	.filter(Boolean);
const selectedObservations = provenance.map(readObservation).filter(Boolean);
const uniqueSelectedObservations = [
	...new Map(
		provenance
			.map((row) => [row.observation_id, readObservation(row)])
			.filter(([, observation]) => Boolean(observation)),
	).values(),
];
const verificationProducts = products.filter((product) =>
	Boolean(product.last_verified_at)
);
const sourceQualityProducts = products.filter((product) =>
	hasSourceQualityMetadata(product.food)
);
const sourceQualityObservations = uniqueSelectedObservations.filter((observation) =>
	hasSourceQualityMetadata(observation.normalized_food)
);
const ingredientAnalysisProducts = products.filter((product) =>
	hasStructuredIngredientAnalysis(product.food)
);
const ingredientAnalysisObservations = uniqueSelectedObservations.filter(
	(observation) => hasStructuredIngredientAnalysis(observation.normalized_food),
);
const revisionProductCount = uniqueCount(revisions, "shared_product_id");
const revisionsWithChanges = uniqueCount(revisionChanges, "revision_id");
const productUpdatesWithStructuredChanges = productUpdateSubmissions.filter(
	(submission) =>
		Array.isArray(submission.change_summary?.changes) &&
		submission.change_summary.changes.length > 0,
).length;
const observedRevisionCount = revisions.filter((revision) =>
	Boolean(revision.label_observed_at)
).length;
const provenanceProductCount = uniqueCount(provenance, "shared_product_id");
const servingProductCount = uniqueCount(servings, "shared_product_id");
const nutrientProductCount = uniqueCount(nutrients, "shared_product_id");
const compatibilityProductCount = uniqueCount(
	compatibilityFacts,
	"shared_product_id",
);
const servingRowsWithEvidence = servings.filter(
	(row) =>
		Boolean(row.source?.trim()) &&
		Boolean(row.confidence?.trim()) &&
		Boolean(
			row.source_reference?.trim() ||
				row.shared_product_observation_id ||
				row.shared_product_revision_id,
		),
).length;
const nutrientRowsWithEvidence = nutrients.filter(
	(row) =>
		Boolean(row.source?.trim()) &&
		Boolean(row.confidence?.trim()) &&
		Boolean(row.value_origin?.trim()) &&
		Boolean(
			row.source_reference?.trim() ||
				row.shared_product_observation_id ||
				row.shared_product_revision_id,
		),
).length;
const policiesWithSnapshots = policyVersions.filter(
	(row) =>
		Array.isArray(row.match_rule_snapshot) &&
		row.match_rule_snapshot.length > 0 &&
		Array.isArray(row.conflict_rule_snapshot) &&
		row.conflict_rule_snapshot.length > 0,
);
const evidenceLinkedFacts = compatibilityFacts.filter((fact) =>
	Boolean(fact.shared_product_observation_id || fact.source_text?.trim())
).length;
const hasValues = (value) =>
	Array.isArray(value) && value.some((item) => String(item ?? "").trim());
const hasObject = (value) =>
	Boolean(
		value &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.keys(value).length > 0,
	);
const hasSourceDate = (metadata) =>
	Boolean(
		metadata?.createdAt ||
			metadata?.publishedAt ||
			metadata?.availableAt ||
			metadata?.modifiedAt ||
			metadata?.updatedAt ||
			metadata?.discontinuedAt,
	);
const catalogEvidenceCoverage = [
	{
		key: "ingredientStatements",
		label: "Products with an ingredient statement",
		hasValue: (food) => Boolean(String(food?.ingredients ?? "").trim()),
	},
	{
		key: "explicitAllergens",
		label: "Products with an explicit contains disclosure",
		hasValue: (food) => hasValues(food?.allergens),
	},
	{
		key: "explicitTraces",
		label: "Products with an explicit may-contain disclosure",
		hasValue: (food) => hasValues(food?.traces),
	},
	{
		key: "structuredIngredients",
		label: "Products with structured ingredients",
		hasValue: (food) => hasValues(food?.structuredIngredients),
	},
	{
		key: "additives",
		label: "Products with reported additives",
		hasValue: (food) => hasValues(food?.additives),
	},
	{
		key: "labels",
		label: "Products with reported labels",
		hasValue: (food) => hasValues(food?.labels),
	},
	{
		key: "packageQuantity",
		label: "Products with package quantity",
		hasValue: (food) => hasObject(food?.packageQuantity),
	},
	{
		key: "sourceRecordMetadata",
		label: "Products with source-record metadata",
		hasValue: (food) => hasObject(food?.sourceMetadata),
	},
	{
		key: "sourceLanguages",
		label: "Products with source-record language",
		hasValue: (food) =>
			Boolean(food?.sourceMetadata?.language) ||
			hasValues(food?.sourceMetadata?.languages),
	},
	{
		key: "sourceMarkets",
		label: "Products with source-record market countries",
		hasValue: (food) => hasValues(food?.sourceMetadata?.marketCountries),
	},
	{
		key: "sourceRevision",
		label: "Products with source-record revision",
		hasValue: (food) =>
			food?.sourceMetadata?.revision !== undefined &&
			food?.sourceMetadata?.revision !== null,
	},
	{
		key: "sourceDates",
		label: "Products with source-record dates",
		hasValue: (food) => hasSourceDate(food?.sourceMetadata),
	},
].map((definition) => {
	const matchingProducts = products.filter((product) =>
		definition.hasValue(product.food)
	);
	return createCoverageRow({
		key: definition.key,
		label: definition.label,
		populated: matchingProducts.length,
		total: products.length,
		unit: "active products",
		representatives: sample(
			matchingProducts.map((product) => describeProduct(product)),
		),
	});
});

const coverage = [
	createCoverageRow({
		key: "lastVerified",
		label: "Products with evidence-backed verification date",
		populated: verificationProducts.length,
		total: products.length,
		unit: "active products",
		representatives: sample(
			verificationProducts.map((product) =>
				describeProduct(product, product.last_verified_at)
			),
		),
	}),
	createCoverageRow({
		key: "revisionHistory",
		label: "Products with an immutable revision",
		populated: revisionProductCount,
		total: products.length,
		unit: "active products",
		representatives: sample(
			revisions.map((revision) => {
				const product = productById.get(revision.shared_product_id);
				return product
					? describeProduct(
							product,
							`revision ${revision.revision_number}; observed ${revision.label_observed_at}`,
						)
					: null;
			}),
		),
	}),
	createCoverageRow({
		key: "currentLabelSince",
		label: "Revisions with an explicit label observation date",
		populated: observedRevisionCount,
		total: revisions.length,
		unit: "revisions",
		representatives: sample(
			revisions.map((revision) => {
				const product = productById.get(revision.shared_product_id);
				return product
					? describeProduct(product, revision.label_observed_at)
					: null;
			}),
		),
	}),
	createCoverageRow({
		key: "revisionChanges",
		label: "Revisions with structured field changes",
		populated: revisionsWithChanges,
		total: revisions.length,
		unit: "revisions",
		representatives: sample(
			revisionChanges.map(
				(change) =>
					`${change.field_label} (${change.change_type}, ${change.severity})`,
			),
		),
	}),
	createCoverageRow({
		key: "fieldProvenance",
		label: "Products with selected field provenance",
		populated: provenanceProductCount,
		total: products.length,
		unit: "active products",
		representatives: sample(
			provenance.map((row) => {
				const product = productById.get(row.shared_product_id);
				const observation = readObservation(row);
				return product
					? describeProduct(
							product,
							`${row.field_path}: ${observation?.source ?? "missing observation"} via ${row.verification_method}`,
						)
					: null;
			}),
		),
	}),
	createCoverageRow({
		key: "sourceObservations",
		label: "Selected fields linked to source observations",
		populated: selectedObservations.length,
		total: provenance.length,
		unit: "selected fields",
		representatives: sample(
			selectedObservations.map(
				(observation) =>
					`${observation.source} · ${observation.source_reference ?? "no reference"} · ${observation.observed_at}`,
			),
		),
	}),
	...catalogEvidenceCoverage,
	createCoverageRow({
		key: "sourceQuality",
		label: "Products with source quality metadata",
		populated: sourceQualityProducts.length,
		total: products.length,
		unit: "active products",
		representatives: sample(
			sourceQualityProducts.map((product) => {
				const metadata = product.food?.sourceMetadata ?? {};
				return describeProduct(
					product,
					`completeness ${metadata.completeness ?? "not reported"}; ${metadata.qualityTags?.length ?? 0} quality tags`,
				);
			}),
		),
	}),
	createCoverageRow({
		key: "observationSourceQuality",
		label: "Selected observations with source quality metadata",
		populated: sourceQualityObservations.length,
		total: uniqueSelectedObservations.length,
		unit: "source observations",
		representatives: [],
	}),
	createCoverageRow({
		key: "ingredientAnalysis",
		label: "Products with structured ingredient analysis",
		populated: ingredientAnalysisProducts.length,
		total: products.length,
		unit: "active products",
		representatives: sample(
			ingredientAnalysisProducts.map((product) =>
				describeProduct(
					product,
					`${product.food?.structuredIngredients?.length ?? 0} structured ingredients`,
				)
			),
		),
	}),
	createCoverageRow({
		key: "observationIngredientAnalysis",
		label: "Selected observations with structured ingredient analysis",
		populated: ingredientAnalysisObservations.length,
		total: uniqueSelectedObservations.length,
		unit: "source observations",
		representatives: [],
	}),
	createCoverageRow({
		key: "servings",
		label: "Products with normalized servings",
		populated: servingProductCount,
		total: products.length,
		unit: "active products",
		representatives: sample(
			servings.map((row) => {
				const product = productById.get(row.shared_product_id);
				return product
					? describeProduct(
							product,
							`${row.label} = ${row.gram_weight}g (${row.source})`,
						)
					: null;
			}),
		),
	}),
	createCoverageRow({
		key: "servingProvenance",
		label: "Normalized serving rows with evidence",
		populated: servingRowsWithEvidence,
		total: servings.length,
		unit: "serving rows",
	}),
	createCoverageRow({
		key: "nutrients",
		label: "Products with normalized nutrients",
		populated: nutrientProductCount,
		total: products.length,
		unit: "active products",
	}),
	createCoverageRow({
		key: "nutrientProvenance",
		label: "Normalized nutrient rows with evidence",
		populated: nutrientRowsWithEvidence,
		total: nutrients.length,
		unit: "nutrient rows",
		representatives: sample(
			nutrients.map(
				(row) =>
					`nutrient ${row.nutrient_id} · ${row.source} · ${row.value_origin}`,
			),
		),
	}),
	createCoverageRow({
		key: "nutrientUncertainty",
		label: "Generic nutrient rows with reported standard error",
		populated: genericNutrientStandardError,
		total: genericNutrientTotal,
		unit: "generic nutrient rows",
		representatives: sample(
			genericNutrientSamples.map(
				(row) =>
					`${row.dataset_key}/${row.source_food_key}: ${row.source_nutrient_name} ${row.amount_per_100g ?? "missing"} ${row.unit_name}; SE ${row.standard_error}`,
			),
		),
	}),
	createCoverageRow({
		key: "nutrientSourceCode",
		label: "Generic nutrient rows with source nutrient code",
		populated: genericNutrientSourceCode,
		total: genericNutrientTotal,
		unit: "generic nutrient rows",
	}),
	createCoverageRow({
		key: "nutrientMapping",
		label: "Generic nutrient rows mapped canonically",
		populated: genericNutrientCanonical,
		total: genericNutrientTotal,
		unit: "generic nutrient rows",
	}),
	createCoverageRow({
		key: "policySnapshots",
		label: "Policy versions with immutable rule snapshots",
		populated: policiesWithSnapshots.length,
		total: policyVersions.length,
		unit: "policy versions",
		representatives: sample(
			policyVersions.map(
				(row) =>
					`v${row.version_number} · ${row.status} · effective ${row.effective_at}`,
			),
		),
	}),
	createCoverageRow({
		key: "compatibilityEvidence",
		label: "Products with compatibility evidence",
		populated: compatibilityProductCount,
		total: products.length,
		unit: "active products",
		representatives: sample(
			compatibilityFacts.map((fact) => {
				const product = productById.get(fact.shared_product_id);
				return product
					? describeProduct(
							product,
							`${fact.fact_type} from ${fact.source_type}`,
						)
					: null;
			}),
		),
	}),
	createCoverageRow({
		key: "compatibilityEvidenceLinks",
		label: "Compatibility facts with retained evidence",
		populated: evidenceLinkedFacts,
		total: compatibilityFacts.length,
		unit: "compatibility facts",
	}),
	createCoverageRow({
		key: "apiReadiness",
		label: "Products publishable through API v1",
		populated: apiReadyProductIds.size,
		total: products.length,
		unit: "active products",
		representatives: sample(
			readiness
				.filter((row) => !row.publishable)
				.map((row) => {
					const product = productById.get(row.shared_product_id);
					return product
						? describeProduct(
								product,
								`withheld: ${(row.reasons ?? []).join(", ")}`,
							)
						: null;
				}),
		),
	}),
	createCoverageRow({
		key: "apiRuntime",
		label: "Publishable products returned by API v1 serialization",
		populated: apiProducts.length,
		total: apiReadyProductIds.size,
		unit: "API-ready products",
		representatives: sample(
			apiProducts.map(
				(product) =>
					`${product.name} (${product.barcode}) · revision ${product.revision.number ?? "unknown"}`,
			),
		),
	}),
	createCoverageRow({
		key: "appRuntime",
		label: "Publishable products returned by the app catalog read",
		populated: appRecords.length,
		total: apiReadyProductIds.size,
		unit: "API-ready products",
		representatives: sample(
			appRecords.map(
				(record) =>
					`${record.productName} (${record.barcode}) · ${record.food.foodNutrients.length} nutrients`,
			),
		),
	}),
];

const coverageByKey = new Map(coverage.map((row) => [row.key, row]));
const apiProductsWith = (predicate) =>
	apiProducts.filter(predicate).length;
const appRecordsWith = (predicate) =>
	appRecords.filter(predicate).length;
const appInformationWith = (predicate) =>
	appInformation.filter(predicate).length;
const semanticCoverage = {
	lastVerified: coverageByKey.get("lastVerified")?.state,
	currentLabelSince: coverageByKey.get("currentLabelSince")?.state,
	revisionHistory:
		`snapshots ${coverageByKey.get("revisionHistory")?.state}; ` +
		`changes ${coverageByKey.get("revisionChanges")?.state}`,
	fieldProvenance: coverageByKey.get("fieldProvenance")?.state,
	sourceQuality:
		`canonical ${coverageByKey.get("sourceQuality")?.state}; ` +
		`observations ${coverageByKey.get("observationSourceQuality")?.state}`,
	ingredientAnalysis:
		`canonical ${coverageByKey.get("ingredientAnalysis")?.state}; ` +
		`observations ${coverageByKey.get("observationIngredientAnalysis")?.state}`,
	servingProvenance: coverageByKey.get("servingProvenance")?.state,
	nutrientUncertainty: coverageByKey.get("nutrientUncertainty")?.state,
	policySnapshots: coverageByKey.get("policySnapshots")?.state,
	compatibilityEvidence:
		`products ${coverageByKey.get("compatibilityEvidence")?.state}; ` +
		`evidence links ${coverageByKey.get("compatibilityEvidenceLinks")?.state}`,
};
const runtimeComparison = {
	lastVerified: {
		api: apiProductsWith((product) =>
			Boolean(product.revision.lastVerifiedAt)
		),
		app: appRecordsWith((record) => Boolean(record.lastVerifiedAt)),
		presented: 0,
	},
	currentLabelSince: {
		api: apiProductsWith((product) =>
			Boolean(product.revision.labelObservedAt)
		),
		app: appRecordsWith((record) =>
			Boolean(record.revision.labelObservedAt)
		),
		presented: 0,
	},
	revisionHistory: {
		api: apiProductsWith((product) => Boolean(product.revision.id)),
		app: appRecordsWith((record) => Boolean(record.revision.id)),
		presented: 0,
	},
	fieldProvenance: {
		api: apiProductsWith((product) =>
			Object.values(product.fieldSources).some(Boolean)
		),
		app: appInformationWith(
			(information) => information.fieldSourceRows.length > 0,
		),
		presented: appInformationWith(
			(information) => information.fieldSourceRows.length > 0,
		),
	},
	sourceQuality: {
		api: apiProductsWith((product) => Boolean(product.sourceRecord)),
		app: appRecordsWith((record) =>
			hasSourceQualityMetadata(record.food)
		),
		presented: 0,
	},
	ingredientAnalysis: {
		api: apiProductsWith(
			(product) =>
				product.ingredients.structured.length > 0 ||
				Boolean(product.ingredients.analysis),
		),
		app: appRecordsWith((record) =>
			hasStructuredIngredientAnalysis(record.food)
		),
		presented: 0,
	},
	servingProvenance: {
		api: apiProductsWith((product) =>
			product.servings.some((serving) => Boolean(serving.source))
		),
		app: appRecordsWith((record) =>
			(record.food.foodServings ?? []).some((serving) =>
				Boolean(serving.source)
			)
		),
		presented: 0,
	},
	nutrientUncertainty: { api: 0, app: 0, presented: 0 },
	policySnapshots: {
		api: 0,
		app: policyVersions.some((version) => version.status === "active")
			? appRecords.length
			: 0,
		presented: 0,
	},
	compatibilityEvidence: {
		api: apiProductsWith((product) => product.warnings.length > 0),
		app: appRecordsWith(
			(record) =>
				(record.food.compatibilitySummary?.allFacts?.length ?? 0) > 0,
		),
		presented: appRecordsWith(
			(record) =>
				(record.food.compatibilitySummary?.allFacts?.length ?? 0) > 0,
		),
	},
};
const layerComparison = CATALOG_TRANSPARENCY_SEMANTICS.map((semantic) => ({
	value: semantic.label,
	semanticOwner: semantic.owner,
	databaseCoverage:
		semanticCoverage[semantic.key] ??
		"measured in a related coverage row",
	apiV1:
		`${runtimeComparison[semantic.key].api}/${apiProducts.length} runtime products; ` +
		semantic.api,
	actualAppRead:
		`${runtimeComparison[semantic.key].app}/${appRecords.length} read; ` +
		`${runtimeComparison[semantic.key].presented}/${appRecords.length} presented. ` +
		semantic.app,
}));

const report = {
	generatedAt: new Date().toISOString(),
	scope: {
		activeCatalogProducts: products.length,
		selectedSourceObservations: uniqueSelectedObservations.length,
		normalizedNutrientRows: nutrients.length,
		normalizedServingRows: servings.length,
		revisions: revisions.length,
		revisionChanges: revisionChanges.length,
		productUpdateSubmissions: productUpdateSubmissions.length,
		productUpdatesWithStructuredChanges,
		apiV1PublishableProducts: apiReadyProductIds.size,
		apiV1RuntimeProducts: apiProducts.length,
		appRuntimeProducts: appRecords.length,
	},
	coverage,
	layerComparison,
	semantics: CATALOG_TRANSPARENCY_SEMANTICS,
};

if (jsonOutput) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log("Catalog transparency and population audit");
	console.log(`Generated: ${report.generatedAt}`);
	console.table(report.scope);
	console.table(
		coverage.map((row) => ({
			metric: row.label,
			state: row.state,
			populated: row.populated,
			total: row.total,
			coverage: `${row.percent}%`,
			unit: row.unit,
		})),
	);
	for (const row of coverage.filter(
		(entry) => entry.representatives.length > 0
	)) {
		console.log(`\n${row.label} examples:`);
		for (const representative of row.representatives) {
			console.log(`- ${representative}`);
		}
	}
	console.log("\nSemantic ownership and exposure:");
	console.table(layerComparison);
	console.log(
		"\nMissing-value rule: absence remains unknown. This audit never converts missing data to zero, verified, current, safe, or low quality.",
	);
}
