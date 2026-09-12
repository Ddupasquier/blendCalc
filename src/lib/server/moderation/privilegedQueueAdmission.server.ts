import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database } from "$lib/types/database.types";
import type { FoodItem } from "$lib/utils/food/types";
import { mapWithConcurrency } from "$lib/server/concurrency/mapWithConcurrency";
import { compareCatalogSubmissionToExistingProduct } from "$lib/utils/products/catalogSubmissionComparison";
import { getDefaultProductResolutionPolicy } from "$lib/server/products/productResolutionPolicy.server";

const ADMISSION_LIMIT = 100;
const PRODUCT_SUBMISSION_ADMISSION_CONCURRENCY = 4;
const DATA_OPERATION_REPAIR_LIMIT = 25;
const ADMISSION_SCHEMA_ERROR_CODES = new Set([
	"42883",
	"42P01",
	"42703",
	"PGRST202",
]);

type AdmissionScope =
	"catalog_review" | "data_operations" | "product_submissions";

type DatabaseError = {
	code?: string | null;
	message?: string | null;
};

const isAdmissionSchemaUnavailable = (error: DatabaseError) =>
	Boolean(error.code && ADMISSION_SCHEMA_ERROR_CODES.has(error.code));

const readCount = (value: unknown, key: string) => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
	const count = (value as Record<string, unknown>)[key];
	return Number.isSafeInteger(count) && (count as number) >= 0
		? (count as number)
		: 0;
};

const applyCatalogAdmission = async () => {
	const admin = getSupabaseAdminClient();
	const { error } = await admin.rpc("apply_catalog_queue_admission", {
		p_limit: ADMISSION_LIMIT,
	});
	if (error && !isAdmissionSchemaUnavailable(error)) throw error;
};

const applyProductSubmissionAdmission = async () => {
	const admin = getSupabaseAdminClient();
	const { data: submissions, error: submissionError } = await admin
		.from("shared_product_submissions")
		.select("id, barcode, food, submission_kind, base_revision_id, updated_at")
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(ADMISSION_LIMIT);
	if (submissionError) throw submissionError;
	if (!submissions?.length) return;

	const barcodes = [
		...new Set(submissions.map((submission) => submission.barcode)),
	];
	const { data: products, error: productError } = await admin
		.from("shared_products")
		.select("id, barcode, product_name, brand_owner, food, updated_at")
		.eq("status", "active")
		.in("barcode", barcodes);
	if (productError) throw productError;
	if (!products?.length) return;

	const productIds = products.map((product) => product.id);
	const { data: revisions, error: revisionError } = await admin
		.from("shared_product_revisions")
		.select("id, shared_product_id, revision_number")
		.in("shared_product_id", productIds)
		.order("revision_number", { ascending: false });
	if (revisionError) throw revisionError;

	const productByBarcode = new Map(
		products.map((product) => [product.barcode, product]),
	);
	const latestRevisionByProductId = new Map<string, string>();
	for (const revision of revisions ?? []) {
		if (!latestRevisionByProductId.has(revision.shared_product_id)) {
			latestRevisionByProductId.set(revision.shared_product_id, revision.id);
		}
	}
	const policy = await getDefaultProductResolutionPolicy();

	await mapWithConcurrency(
		submissions,
		PRODUCT_SUBMISSION_ADMISSION_CONCURRENCY,
		async (submission) => {
			const product = productByBarcode.get(submission.barcode);
			if (!product) return;
			const latestRevisionId = latestRevisionByProductId.get(product.id);
			if (!latestRevisionId) return;

			const comparison = compareCatalogSubmissionToExistingProduct(
				submission.food as unknown as FoodItem,
				{
					...(product.food as unknown as FoodItem),
					description: product.product_name,
					brandOwner: product.brand_owner ?? undefined,
				},
				policy,
			);
			const reasonCode = comparison.matchesExisting
				? "exact_current_catalog_match"
				: submission.submission_kind === "product_update" &&
					  submission.base_revision_id !== latestRevisionId
					? "stale_base_revision"
					: submission.submission_kind === "new_product"
						? "catalog_product_now_exists"
						: null;
			if (!reasonCode) return;

			const evidenceSnapshot = {
				sharedProductId: product.id,
				latestRevisionId,
				productUpdatedAt: product.updated_at,
				submissionUpdatedAt: submission.updated_at,
				matchesExisting: comparison.matchesExisting,
				changedFields: comparison.changedFields,
			};
			const { error } = await admin.rpc(
				"resolve_catalog_submission_queue_admission",
				{
					p_submission_id: submission.id,
					p_reason_code: reasonCode,
					p_evidence_snapshot: evidenceSnapshot,
				},
			);
			if (error && !isAdmissionSchemaUnavailable(error)) throw error;
		},
	);
};

const applyExactDataOperationRepairs = async (
	supabase: SupabaseClient<Database>,
) => {
	const admin = getSupabaseAdminClient();
	const { data: issueCodes, error: issueCodeError } = await admin
		.from("app_issue_codes")
		.select("code")
		.eq("enabled", true)
		.eq("responsible_group", "data_operations")
		.eq("automated_repair_allowed", true)
		.not("automated_repair_key", "is", null);
	if (issueCodeError) throw issueCodeError;
	const repairableCodes = new Set(
		(issueCodes ?? []).map((issue) => issue.code),
	);
	if (repairableCodes.size === 0) return;

	const { data: occurrences, error: occurrenceError } = await admin
		.from("catalog_health_actionable_issue_occurrences")
		.select("occurrence_key, issue_code, detected_at")
		.eq("status", "open")
		.in("issue_code", [...repairableCodes])
		.order("detected_at", { ascending: true })
		.limit(DATA_OPERATION_REPAIR_LIMIT);
	if (occurrenceError) throw occurrenceError;
	const repairableOccurrences = (occurrences ?? []).filter(
		(
			occurrence,
		): occurrence is typeof occurrence & {
			occurrence_key: string;
			detected_at: string;
		} => Boolean(occurrence.occurrence_key && occurrence.detected_at),
	);
	if (repairableOccurrences.length === 0) return;

	const occurrenceKeys = repairableOccurrences.map(
		(occurrence) => occurrence.occurrence_key,
	);
	const { data: priorRuns, error: priorRunError } = await admin
		.from("catalog_health_repair_runs")
		.select(
			"occurrence_key, mode, status, candidate_count, unresolved_count, started_at",
		)
		.in("occurrence_key", occurrenceKeys)
		.eq("mode", "dry_run")
		.order("started_at", { ascending: false });
	if (priorRunError) throw priorRunError;
	const latestRunByOccurrence = new Map<string, (typeof priorRuns)[number]>();
	for (const run of priorRuns ?? []) {
		if (!latestRunByOccurrence.has(run.occurrence_key)) {
			latestRunByOccurrence.set(run.occurrence_key, run);
		}
	}

	for (const occurrence of repairableOccurrences) {
		const priorRun = latestRunByOccurrence.get(occurrence.occurrence_key);
		if (
			priorRun &&
			["completed", "completed_with_unresolved"].includes(priorRun.status) &&
			priorRun.candidate_count === 0 &&
			new Date(priorRun.started_at).getTime() >=
				new Date(occurrence.detected_at).getTime()
		) {
			continue;
		}

		const { data: dryRun, error: dryRunError } = await supabase.rpc(
			"run_catalog_health_repair",
			{
				p_occurrence_key: occurrence.occurrence_key,
				p_apply: false,
			},
		);
		if (dryRunError?.code === "42501") return;
		if (dryRunError?.code === "P0002") continue;
		if (dryRunError) throw dryRunError;
		if (readCount(dryRun, "candidateCount") === 0) continue;
		const runId =
			dryRun && typeof dryRun === "object" && !Array.isArray(dryRun)
				? (dryRun as Record<string, unknown>).runId
				: null;
		if (typeof runId !== "string") {
			throw new Error("Catalog repair dry run did not return its audit ID.");
		}
		const { error: applyError } = await supabase.rpc(
			"run_catalog_health_repair",
			{
				p_occurrence_key: occurrence.occurrence_key,
				p_apply: true,
				p_dry_run_id: runId,
			},
		);
		if (applyError?.code === "P0002") continue;
		if (applyError) throw applyError;
	}
};

export const runPrivilegedQueueAdmission = async (
	supabase: SupabaseClient<Database>,
	scopes: readonly AdmissionScope[],
) => {
	const scopeSet = new Set(scopes);
	if (scopeSet.has("catalog_review") || scopeSet.has("product_submissions")) {
		await applyCatalogAdmission();
	}
	if (scopeSet.has("product_submissions")) {
		await applyProductSubmissionAdmission();
	}
	if (scopeSet.has("data_operations")) {
		await applyExactDataOperationRepairs(supabase);
	}
};
