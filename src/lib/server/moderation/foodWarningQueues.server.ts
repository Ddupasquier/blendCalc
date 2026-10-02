import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database.types";
import { createFoodCompatibilityEvidenceSignedUrl } from "$lib/server/food-safety/foodCompatibilityEvidence.server";
import { throwAppError } from "$lib/server/errors/appError.server";
import {
	FOOD_WARNING_QUEUE_PAGE_SIZE,
	encodeFoodWarningQueueCursor,
	type FoodWarningQueueCursor,
	type FoodWarningQueueKey,
	type FoodWarningQueuePage,
	type FoodWarningQueueRows,
} from "$lib/utils/moderation/foodWarningQueuePagination";

type QueueContext = { supabase: SupabaseClient<Database> };
const readJoinedRecord = (value: unknown): Record<string, unknown> => {
	const record = Array.isArray(value) ? value[0] : value;
	return record && typeof record === "object" ? record : {};
};

// Values have been strictly validated before interpolation into PostgREST filters.
const cursorFilter = (cursor: FoodWarningQueueCursor) =>
	`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`;

const pageResult = <Row extends { id: string; created_at: string }>(
	rows: Row[],
	total: number | null,
) => {
	if (total === null) return throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	const items = rows.slice(0, FOOD_WARNING_QUEUE_PAGE_SIZE);
	const last = items.at(-1);
	return {
		items,
		total,
		nextCursor:
			rows.length > FOOD_WARNING_QUEUE_PAGE_SIZE && last
				? encodeFoodWarningQueueCursor({
						id: last.id,
						createdAt: last.created_at,
					})
				: null,
	};
};

export const readFoodWarningReportPage = async (
	{ supabase }: QueueContext,
	cursor: FoodWarningQueueCursor | null = null,
): Promise<FoodWarningQueuePage<FoodWarningQueueRows["reports"]>> => {
	let query = supabase
		.from("food_compatibility_feedback")
		.select(
			"id, reported_by, feedback_type, shared_product_id, shared_product_revision_id, source_key, source_id, barcode, food_description, warning_id, issue_code, issue_params, fact_snapshot, preference_type, preference_value, observed_label_date, evidence_path, report_reason, report_details, created_at, policy_version:food_compatibility_policy_versions(version_number)",
		)
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.order("id", { ascending: true })
		.limit(FOOD_WARNING_QUEUE_PAGE_SIZE + 1);
	if (cursor) query = query.or(cursorFilter(cursor));
	const [result, countResult] = await Promise.all([
		query,
		supabase
			.from("food_compatibility_feedback")
			.select("id", { count: "exact", head: true })
			.eq("status", "pending"),
	]);
	if (result.error || countResult.error) {
		throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
	const page = pageResult(result.data ?? [], countResult.count);
	return {
		...page,
		items: await Promise.all(
			page.items.map(async (feedback) => {
				const policy = readJoinedRecord(feedback.policy_version);
				return {
					id: feedback.id,
					feedbackType: feedback.feedback_type,
					reportedBy: feedback.reported_by,
					sharedProductId: feedback.shared_product_id,
					sharedProductRevisionId: feedback.shared_product_revision_id,
					sourceKey: feedback.source_key,
					sourceId: feedback.source_id,
					barcode: feedback.barcode,
					foodDescription: feedback.food_description,
					warningId: feedback.warning_id,
					issueCode: feedback.issue_code,
					issueParams: feedback.issue_params,
					factSnapshot: feedback.fact_snapshot,
					preferenceType: feedback.preference_type,
					preferenceValue: feedback.preference_value,
					observedLabelDate: feedback.observed_label_date,
					evidenceUrl: await createFoodCompatibilityEvidenceSignedUrl(
						feedback.evidence_path,
					),
					reportReason: feedback.report_reason,
					reportDetails: feedback.report_details,
					createdAt: feedback.created_at,
					policyVersion:
						typeof policy.version_number === "number"
							? policy.version_number
							: null,
				};
			}),
		),
	};
};

export const readFoodWarningProductCorrectionPage = async (
	{ supabase }: QueueContext,
	cursor: FoodWarningQueueCursor | null = null,
): Promise<
	FoodWarningQueuePage<FoodWarningQueueRows["productCorrections"]>
> => {
	let query = supabase
		.from("catalog_correction_origins")
		.select(
			"id, shared_product_id, affected_field_paths, status, submission_id, created_at, product:shared_products(product_name, barcode), feedback:food_compatibility_feedback(feedback_type, report_reason)",
		)
		.eq("origin_type", "food_warning_report")
		.in("status", ["waiting_for_correction", "linked"])
		.order("created_at", { ascending: true })
		.order("id", { ascending: true })
		.limit(FOOD_WARNING_QUEUE_PAGE_SIZE + 1);
	if (cursor) query = query.or(cursorFilter(cursor));
	const [result, countResult] = await Promise.all([
		query,
		supabase
			.from("catalog_correction_origins")
			.select("id", { count: "exact", head: true })
			.eq("origin_type", "food_warning_report")
			.in("status", ["waiting_for_correction", "linked"]),
	]);
	if (result.error || countResult.error) {
		throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
	const page = pageResult(result.data ?? [], countResult.count);
	return {
		...page,
		items: page.items.map((record) => {
			const product = readJoinedRecord(record.product);
			const feedback = readJoinedRecord(record.feedback);
			return {
				id: record.id,
				sharedProductId: record.shared_product_id,
				productName: String(product.product_name ?? "Catalog product"),
				barcode: String(product.barcode ?? "Barcode unavailable"),
				affectedFieldPaths: record.affected_field_paths,
				status: record.status,
				submissionId: record.submission_id,
				feedbackType: String(feedback.feedback_type ?? "warning_report"),
				reportReason: String(feedback.report_reason ?? "other"),
				createdAt: record.created_at,
			};
		}),
	};
};

export const readFoodWarningPolicyReviewPage = async (
	{ supabase }: QueueContext,
	cursor: FoodWarningQueueCursor | null = null,
): Promise<FoodWarningQueuePage<FoodWarningQueueRows["policyReviews"]>> => {
	let query = supabase
		.from("food_warning_policy_review_cases")
		.select(
			"id, case_type, responsible_group, shared_product_id, source_key, status, created_at, product:shared_products(product_name, barcode), feedback:food_compatibility_feedback(food_description, feedback_type, report_reason)",
		)
		.in("status", ["open", "deferred"])
		.order("created_at", { ascending: true })
		.order("id", { ascending: true })
		.limit(FOOD_WARNING_QUEUE_PAGE_SIZE + 1);
	if (cursor) query = query.or(cursorFilter(cursor));
	const [result, countResult] = await Promise.all([
		query,
		supabase
			.from("food_warning_policy_review_cases")
			.select("id", { count: "exact", head: true })
			.in("status", ["open", "deferred"]),
	]);
	if (result.error || countResult.error) {
		throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
	const page = pageResult(result.data ?? [], countResult.count);
	return {
		...page,
		items: page.items.map((record) => {
			const product = readJoinedRecord(record.product);
			const feedback = readJoinedRecord(record.feedback);
			return {
				id: record.id,
				caseType: record.case_type,
				responsibleGroup: record.responsible_group,
				sharedProductId: record.shared_product_id,
				productName: String(
					product.product_name ?? feedback.food_description ?? "Reported food",
				),
				barcode: typeof product.barcode === "string" ? product.barcode : null,
				sourceKey: record.source_key,
				status: record.status,
				feedbackType: String(feedback.feedback_type ?? "warning_report"),
				reportReason: String(feedback.report_reason ?? "other"),
				createdAt: record.created_at,
			};
		}),
	};
};

export const readFoodWarningQueuePage = async <Key extends FoodWarningQueueKey>(
	context: QueueContext,
	queue: Key,
	cursor: FoodWarningQueueCursor | null = null,
): Promise<FoodWarningQueuePage<FoodWarningQueueRows[Key]>> => {
	const readers = {
		reports: readFoodWarningReportPage,
		productCorrections: readFoodWarningProductCorrectionPage,
		policyReviews: readFoodWarningPolicyReviewPage,
	};
	return readers[queue](context, cursor) as Promise<
		FoodWarningQueuePage<FoodWarningQueueRows[Key]>
	>;
};
