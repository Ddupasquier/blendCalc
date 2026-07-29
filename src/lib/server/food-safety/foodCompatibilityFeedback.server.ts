import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	APP_ISSUE_CODES,
	type AppIssueCode,
	type AppIssueParams,
} from "$lib/utils/errors/appIssues";
import type {
	FoodCompatibilityFeedbackReason,
	FoodCompatibilityFeedbackRequest,
} from "$lib/utils/food/quality/compatibilityFeedback";

const warningIssueCodes = new Set<AppIssueCode>([
	"FOOD_INTRINSIC_ALLERGEN",
	"FOOD_ALLERGEN_CONTAINS",
	"FOOD_ALLERGEN_MAY_CONTAIN",
	"FOOD_INGREDIENT_PRESENT",
	"FOOD_RESTRICTION_CONFLICT",
]);
const feedbackReasons = new Set<FoodCompatibilityFeedbackReason>([
	"incorrect_match",
	"outdated_source_data",
	"wrong_evidence_type",
	"other",
]);
const resolutionActions = new Set([
	"none",
	"rule_review",
	"source_correction",
	"product_correction",
	"duplicate",
] as const);

export type FoodCompatibilityFeedbackReview = {
	id: string;
	status: "confirmed" | "dismissed";
	resolutionAction:
		| "none"
		| "rule_review"
		| "source_correction"
		| "product_correction"
		| "duplicate";
	reviewNote: string;
};

const readOptionalString = (
	value: unknown,
	maximumLength: number,
) => {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return normalized
		? normalized.slice(0, maximumLength)
		: null;
};

const readParams = (value: unknown): AppIssueParams | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const sourceEntries = Object.entries(value);
	const entries = sourceEntries.flatMap(([key, item]) =>
		(
			typeof item === "string" ||
			typeof item === "number" ||
			typeof item === "boolean"
		)
			? [[key.slice(0, 80), item] as const]
			: []
	);
	if (entries.length !== sourceEntries.length) return null;
	const params = Object.fromEntries(entries);
	return JSON.stringify(params).length <= 2000 ? params : null;
};

const readFactSnapshot = (value: unknown) => {
	if (!Array.isArray(value)) return [];
	const snapshot = value.slice(0, 12);
	return JSON.stringify(snapshot).length <= 12000 ? snapshot : [];
};

export const parseFoodCompatibilityFeedbackRequest = (
	value: unknown,
): FoodCompatibilityFeedbackRequest | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const input = value as Record<string, unknown>;
	const issueCode = readOptionalString(input.issueCode, 80);
	const reportReason = readOptionalString(input.reportReason, 80);
	const sourceId = readOptionalString(input.sourceId, 200);
	const foodDescription = readOptionalString(input.foodDescription, 300);
	const warningId = readOptionalString(input.warningId, 240);
	const issueParams = readParams(input.issueParams);

	if (
		!issueCode ||
		!APP_ISSUE_CODES.includes(issueCode as AppIssueCode) ||
		!warningIssueCodes.has(issueCode as AppIssueCode) ||
		!reportReason ||
		!feedbackReasons.has(reportReason as FoodCompatibilityFeedbackReason) ||
		!sourceId ||
		!foodDescription ||
		!warningId ||
		!issueParams
	) {
		return null;
	}

	return {
		sharedProductId: readOptionalString(input.sharedProductId, 80),
		sourceKey: readOptionalString(input.sourceKey, 80),
		sourceId,
		barcode: readOptionalString(input.barcode, 32),
		foodDescription,
		warningId,
		issueCode: issueCode as AppIssueCode,
		issueParams,
		factSnapshot: readFactSnapshot(input.factSnapshot) as FoodCompatibilityFeedbackRequest["factSnapshot"],
		reportReason: reportReason as FoodCompatibilityFeedbackReason,
		reportDetails: readOptionalString(input.reportDetails, 1000),
	};
};

const getActivePolicyVersion = async () => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("food_compatibility_policy_versions")
		.select("id, version_number")
		.eq("status", "active")
		.order("version_number", { ascending: false })
		.limit(1)
		.single();

	if (error) throw error;
	return data;
};

export const submitFoodCompatibilityFeedback = async (
	userId: string,
	input: FoodCompatibilityFeedbackRequest,
) => {
	const admin = getSupabaseAdminClient();
	const policyVersion = await getActivePolicyVersion();
	const reportFingerprint = createHash("sha256")
		.update(JSON.stringify({
			policyVersion: policyVersion.version_number,
			sharedProductId: input.sharedProductId,
			sourceKey: input.sourceKey,
			sourceId: input.sourceId,
			barcode: input.barcode,
			warningId: input.warningId,
		}))
		.digest("hex");
	const { error } = await admin
		.from("food_compatibility_feedback")
		.insert({
			reported_by: userId,
			policy_version_id: policyVersion.id,
			shared_product_id: input.sharedProductId,
			source_key: input.sourceKey,
			source_id: input.sourceId,
			barcode: input.barcode,
			food_description: input.foodDescription,
			warning_id: input.warningId,
			issue_code: input.issueCode,
			issue_params: input.issueParams,
			fact_snapshot: { facts: input.factSnapshot },
			report_reason: input.reportReason,
			report_details: input.reportDetails,
			report_fingerprint: reportFingerprint,
		});

	if (!error) return "submitted" as const;
	if (error.code === "23505") return "already_pending" as const;
	throw error;
};

export const listPendingFoodCompatibilityFeedback = async () => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("food_compatibility_feedback")
		.select(
			"id, reported_by, shared_product_id, source_key, source_id, barcode, food_description, warning_id, issue_code, issue_params, fact_snapshot, report_reason, report_details, created_at, policy_version:food_compatibility_policy_versions(version_number)",
		)
		.eq("status", "pending")
		.order("created_at", { ascending: true });

	if (error) throw error;
	return data ?? [];
};

export const reviewFoodCompatibilityFeedback = async (
	reviewerId: string,
	review: FoodCompatibilityFeedbackReview,
) => {
	if (
		!review.id ||
		!["confirmed", "dismissed"].includes(review.status) ||
		!resolutionActions.has(review.resolutionAction) ||
		!review.reviewNote.trim()
	) {
		return false;
	}

	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("food_compatibility_feedback")
		.update({
			status: review.status,
			resolution_action: review.resolutionAction,
			reviewed_by: reviewerId,
			reviewed_at: new Date().toISOString(),
			review_note: review.reviewNote.trim().slice(0, 2000),
		})
		.eq("id", review.id)
		.eq("status", "pending")
		.select("id")
		.maybeSingle();

	if (error) throw error;
	return Boolean(data);
};
