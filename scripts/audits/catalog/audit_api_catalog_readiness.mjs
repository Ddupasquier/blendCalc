/**
 * Purpose: Audit every active shared-products catalog row against the blendCalc API v1
 * publication gate and print its canonical provenance, normalized data coverage, asset
 * coverage, and any reason the row is withheld from API reads. This script is read-only.
 * Run: `npm run audit:api-catalog`
 * JSON: `npm run audit:api-catalog -- --json`
 * Strict: `npm run audit:api-catalog -- --strict`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
	buildCatalogReadinessSummary,
	classifyCatalogReadinessIssue,
	isCatalogReadinessContractUnavailable,
} from "../../lib/catalog/apiCatalogReadiness.mjs";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const strict = process.argv.includes("--strict");
const jsonOutput = process.argv.includes("--json");

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

const readOptionalCatalogContractRows = async (label, request) => {
	const { data, error } = await request;
	if (!error) return data ?? [];
	if (!isCatalogReadinessContractUnavailable(error)) {
		throw new Error(`${label}: ${error.message}`);
	}
	console.error(
		`${label} is not deployed yet; affected blockers remain unclassified.`,
	);
	return [];
};

const readIssueContracts = async () => {
	const fullRequest = await supabase
		.from("app_issue_codes")
		.select(
			"code, operational_severity, responsible_group, resolution_action, automated_repair_key, automated_repair_allowed",
		)
		.eq("enabled", true);
	if (!fullRequest.error) return fullRequest.data ?? [];
	if (!isCatalogReadinessContractUnavailable(fullRequest.error)) {
		throw new Error(
			`Catalog health issue contracts: ${fullRequest.error.message}`,
		);
	}

	console.error(
		"Catalog health issue ownership is not deployed yet; affected blockers remain unclassified.",
	);
	return readRows(
		"Legacy catalog issue codes",
		supabase.from("app_issue_codes").select("code").eq("enabled", true),
	);
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

const readObservation = (row) =>
	Array.isArray(row.shared_product_observations)
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

const [
	readiness,
	provenance,
	nutrients,
	servings,
	images,
	conflicts,
	issueOccurrences,
	issueContracts,
] = await Promise.all([
	readRows(
		"API readiness",
		supabase
			.from("blendcalc_api_v1_product_readiness")
			.select(
				"shared_product_id, publishable, reasons, profile_key, publication_status, quality_dimensions",
			),
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
						"shared_product_id, nutrient_id, value_status, mapping_status, source, source_reference, confidence",
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
	productIds.length
		? readRows(
				"Open catalog conflicts",
				supabase
					.from("shared_product_conflicts")
					.select("shared_product_id, severity")
					.in("shared_product_id", productIds)
					.eq("status", "open"),
			)
		: [],
	productIds.length
		? readOptionalCatalogContractRows(
				"Catalog health issue occurrences",
				supabase
					.from("catalog_health_issue_occurrences")
					.select(
						"occurrence_key, issue_code, shared_product_id, source_reason",
					)
					.in("shared_product_id", productIds),
			)
		: [],
	readIssueContracts(),
]);

const readinessByProduct = new Map(
	readiness.map((row) => [row.shared_product_id, row]),
);
const provenanceCounts = groupCounts(provenance, "shared_product_id");
const nutrientCounts = groupCounts(nutrients, "shared_product_id");
const servingCounts = groupCounts(servings, "shared_product_id");
const provenanceByProduct = groupRows(provenance, "shared_product_id");
const nutrientsByProduct = groupRows(nutrients, "shared_product_id");
const servingsByProduct = groupRows(servings, "shared_product_id");
const imagesByProduct = groupRows(images, "shared_product_id");
const conflictsByProduct = groupRows(conflicts, "shared_product_id");
const issueOccurrencesByProduct = groupRows(
	issueOccurrences,
	"shared_product_id",
);
const issueContractsByCode = new Map(
	issueContracts.map((issueContract) => [issueContract.code, issueContract]),
);
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
	const productNutrients = nutrientsByProduct.get(product.id) ?? [];
	const productConflicts = conflictsByProduct.get(product.id) ?? [];
	const productIssues = (issueOccurrencesByProduct.get(product.id) ?? []).map(
		(occurrence) => {
			const issueContract = issueContractsByCode.get(occurrence.issue_code);
			return {
				issueCode: occurrence.issue_code,
				reason: occurrence.source_reason,
				owner: classifyCatalogReadinessIssue(issueContract),
				severity: issueContract?.operational_severity ?? "unknown",
				resolutionAction: issueContract?.resolution_action ?? "unclassified",
				automatedRepairKey: issueContract?.automated_repair_allowed
					? issueContract.automated_repair_key
					: null,
			};
		},
	);
	return {
		barcode: product.barcode,
		product: product.product_name,
		catalogSource: product.source,
		api: status?.publishable ? "included" : "withheld",
		publicationStatus: status?.publication_status ?? "not_evaluated",
		profile: status?.profile_key ?? "none",
		reasons: status?.reasons ?? ["readiness_not_evaluated"],
		issues: productIssues,
		automatedRepairCandidates: productIssues.filter(
			(issue) => issue.owner === "safe_automated_repair",
		).length,
		humanReviewCandidates: productIssues.filter((issue) =>
			[
				"catalog_review",
				"data_operations_review",
				"food_policy_review",
			].includes(issue.owner),
		).length,
		externalReviewCandidates: productIssues.filter(
			(issue) => issue.owner === "external_review",
		).length,
		resolutionActions: [
			...new Set(productIssues.map((issue) => issue.resolutionAction)),
		].sort(),
		category: product.category_option_id ? "yes" : "no",
		fieldSources: provenanceCounts.get(product.id) ?? 0,
		fieldLineage: (provenanceByProduct.get(product.id) ?? [])
			.sort((left, right) => left.field_path.localeCompare(right.field_path))
			.map(
				(row) =>
					`${row.field_path}=${readObservation(row)?.source ?? "missing"}`,
			)
			.join(", "),
		nutrients: nutrientCounts.get(product.id) ?? 0,
		reportedZeroes: productNutrients.filter(
			(nutrient) => nutrient.value_status === "reported-zero",
		).length,
		unreviewedMappings: productNutrients.filter(
			(nutrient) => nutrient.mapping_status !== "canonical",
		).length,
		requiredNutrition:
			status?.quality_dimensions?.nutrition?.acceptedCount === undefined
				? "unknown"
				: `${status.quality_dimensions.nutrition.acceptedCount}/${status.quality_dimensions.nutrition.requiredCount}`,
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
		imageSources: summarizeSources(productImages, (row) => row.source),
		imageRights:
			productImages.length === 0
				? "none"
				: incompleteImageRights.has(product.id)
					? "incomplete"
					: "complete",
		openConflicts: productConflicts.length,
		materialConflicts: productConflicts.filter(
			(conflict) =>
				conflict.severity === "medium" || conflict.severity === "high",
		).length,
	};
});

const summary = buildCatalogReadinessSummary(report);
if (jsonOutput) {
	console.log(JSON.stringify({ summary, products: report }, null, 2));
} else {
	console.table(
		report.map((row) => ({
			...row,
			reasons: row.reasons.join(", "),
			issues: row.issues.map((issue) => issue.issueCode).join(", "),
			resolutionActions: row.resolutionActions.join(", "),
		})),
	);
	console.log(JSON.stringify(summary, null, 2));
}

if (strict && summary.apiWithheld > 0) {
	process.exitCode = 1;
}
