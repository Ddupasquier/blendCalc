import { createHash } from "node:crypto";
import {
	createFoodCompatibilityEvidenceSignedUrl,
	deleteFoodCompatibilityEvidence,
	uploadFoodCompatibilityEvidence,
	type FoodCompatibilityEvidenceUpload,
} from "$lib/server/food-safety/foodCompatibilityEvidence.server";
import { getUserFoodPreferenceResolutions } from "$lib/server/food-safety/userFoodPreferenceResolution.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Json } from "$lib/types/database.types";
import {
	APP_ISSUE_CODES,
	type AppIssueCode,
	type AppIssueParams,
} from "$lib/utils/errors/appIssues";
import type {
	FoodCompatibilityFeedbackReason,
	FoodCompatibilityFeedbackRequest,
} from "$lib/utils/food/quality/compatibilityFeedback";
import type { FoodPreferenceRuleType } from "$lib/utils/profile/foodPreferenceProfile";

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

export type MissingFoodWarningFeedbackRequest = {
	sharedProductId: string | null;
	sourceKey: string | null;
	sourceId: string;
	barcode: string | null;
	foodDescription: string;
	preferenceTagId: string;
	preferenceType: FoodPreferenceRuleType;
	observedLabelDate: string | null;
	reportDetails: string;
	evidenceFile: File | null;
};

type ResolvedFeedbackProduct = {
	sharedProductId: string | null;
	sharedProductRevisionId: string | null;
	sourceKey: string | null;
	sourceId: string;
	barcode: string | null;
	foodDescription: string;
	factSnapshot: Json;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BARCODE_PATTERN = /^\d{8,14}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

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

const readRequiredString = (value: FormDataEntryValue | null, maximumLength: number) => {
	const normalized = readOptionalString(value, maximumLength);
	return normalized ?? "";
};

const readObservedLabelDate = (value: FormDataEntryValue | null) => {
	const normalized = readOptionalString(value, 10);
	if (!normalized) return null;
	if (!DATE_PATTERN.test(normalized)) return undefined;
	const date = new Date(`${normalized}T00:00:00.000Z`);
	if (
		Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== normalized ||
		date.getTime() > Date.now()
	) {
		return undefined;
	}
	return normalized;
};

export const parseMissingFoodWarningFeedbackRequest = (
	formData: FormData,
): MissingFoodWarningFeedbackRequest | null => {
	const preferenceTagId = readRequiredString(formData.get("preferenceTagId"), 80);
	const preferenceType = readRequiredString(formData.get("preferenceType"), 40);
	const sourceId = readRequiredString(formData.get("sourceId"), 200);
	const foodDescription = readRequiredString(formData.get("foodDescription"), 300);
	const reportDetails = readRequiredString(formData.get("reportDetails"), 1000);
	const observedLabelDate = readObservedLabelDate(formData.get("observedLabelDate"));
	const evidenceEntry = formData.get("evidence");
	const evidenceFile = evidenceEntry instanceof File && evidenceEntry.size > 0
		? evidenceEntry
		: null;

	if (
		!UUID_PATTERN.test(preferenceTagId) ||
		!(["allergen", "dietary_restriction"] as const).includes(
			preferenceType as FoodPreferenceRuleType,
		) ||
		!sourceId ||
		!foodDescription ||
		reportDetails.length < 10 ||
		observedLabelDate === undefined
	) {
		return null;
	}

	const sharedProductId = readOptionalString(formData.get("sharedProductId"), 80);
	if (sharedProductId && !UUID_PATTERN.test(sharedProductId)) return null;
	const barcode = readOptionalString(formData.get("barcode"), 14);
	if (barcode && !BARCODE_PATTERN.test(barcode)) return null;

	return {
		sharedProductId,
		sourceKey: readOptionalString(formData.get("sourceKey"), 80),
		sourceId,
		barcode,
		foodDescription,
		preferenceTagId,
		preferenceType: preferenceType as FoodPreferenceRuleType,
		observedLabelDate,
		reportDetails,
		evidenceFile,
	};
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

const getCurrentSharedProduct = async (
	sharedProductId: string | null,
	barcode: string | null,
) => {
	const admin = getSupabaseAdminClient();
	let query = admin
		.from("shared_products")
		.select(
			"id, barcode, product_name, source, source_reference, compatibility_summary",
		)
		.eq("status", "active");
	if (sharedProductId) query = query.eq("id", sharedProductId);
	else if (barcode) query = query.eq("barcode", barcode.padStart(14, "0"));
	else return null;

	const { data, error } = await query.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	const { data: revision, error: revisionError } = await admin
		.from("shared_product_revisions")
		.select("id, revision_number, label_observed_at")
		.eq("shared_product_id", data.id)
		.order("revision_number", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (revisionError) throw revisionError;

	return {
		sharedProductId: data.id,
		sharedProductRevisionId: revision?.id ?? null,
		sourceKey: data.source,
		sourceId: data.source_reference ?? data.id,
		barcode: data.barcode,
		foodDescription: data.product_name,
		factSnapshot: {
			compatibilitySummary: data.compatibility_summary,
			catalogRevision: revision
				? {
					id: revision.id,
					number: revision.revision_number,
					labelObservedAt: revision.label_observed_at,
				}
				: null,
		},
	} satisfies ResolvedFeedbackProduct;
};

const getGenericFeedbackProduct = async (
	sourceKey: string | null,
	sourceId: string,
) => {
	const applicationFoodId = Number(sourceId);
	if (!Number.isSafeInteger(applicationFoodId) || applicationFoodId <= 0) {
		return null;
	}

	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("generic_food_records")
		.select(
			"application_food_id, dataset_key, source_food_key, description, source_updated_at, dataset:generic_food_datasets!generic_food_records_dataset_key_fkey(source_key, version)",
		)
		.eq("application_food_id", applicationFoodId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	const dataset = data.dataset as unknown as {
		source_key: string;
		version: string;
	} | null;
	if (sourceKey && dataset?.source_key && sourceKey !== dataset.source_key) {
		return null;
	}

	return {
		sharedProductId: null,
		sharedProductRevisionId: null,
		sourceKey: dataset?.source_key ?? sourceKey,
		sourceId: String(data.application_food_id),
		barcode: null,
		foodDescription: data.description,
		factSnapshot: {
			genericRecord: {
				datasetKey: data.dataset_key,
				datasetVersion: dataset?.version ?? null,
				sourceFoodKey: data.source_food_key,
				sourceUpdatedAt: data.source_updated_at,
			},
		},
	} satisfies ResolvedFeedbackProduct;
};

const resolveFeedbackProduct = async (
	input: MissingFoodWarningFeedbackRequest,
): Promise<ResolvedFeedbackProduct | null> => {
	const sharedProduct = await getCurrentSharedProduct(
		input.sharedProductId,
		input.barcode,
	);
	if (sharedProduct) return sharedProduct;
	if (input.sharedProductId) return null;

	const genericProduct = await getGenericFeedbackProduct(
		input.sourceKey,
		input.sourceId,
	);
	if (genericProduct) return genericProduct;

	if (!input.barcode || !input.sourceKey) return null;
	return {
		sharedProductId: null,
		sharedProductRevisionId: null,
		sourceKey: input.sourceKey,
		sourceId: input.sourceId,
		barcode: input.barcode.padStart(14, "0"),
		foodDescription: input.foodDescription,
		factSnapshot: { externalIdentity: "exact-barcode" },
	};
};

export const submitMissingFoodWarningFeedback = async (
	userId: string,
	input: MissingFoodWarningFeedbackRequest,
) => {
	const admin = getSupabaseAdminClient();
	const [policyVersion, preferenceResolutions, product] = await Promise.all([
		getActivePolicyVersion(),
		getUserFoodPreferenceResolutions(admin, userId),
		resolveFeedbackProduct(input),
	]);
	const preference = preferenceResolutions.find((resolution) =>
		resolution.status === "resolved" &&
		resolution.ruleType === input.preferenceType &&
		resolution.tag?.id === input.preferenceTagId
	);
	if (!preference?.tag || !product) return "invalid" as const;

	const reportFingerprint = createHash("sha256")
		.update(JSON.stringify({
			feedbackType: "missing_warning",
			policyVersion: policyVersion.version_number,
			sharedProductId: product.sharedProductId,
			sourceKey: product.sourceKey,
			sourceId: product.sourceId,
			barcode: product.barcode,
			preferenceTagId: preference.tag.id,
		}))
		.digest("hex");
	const { data: pending, error: pendingError } = await admin
		.from("food_compatibility_feedback")
		.select("id")
		.eq("reported_by", userId)
		.eq("report_fingerprint", reportFingerprint)
		.eq("status", "pending")
		.maybeSingle();
	if (pendingError) throw pendingError;
	if (pending) return "already_pending" as const;

	let evidence: FoodCompatibilityEvidenceUpload | null = null;
	try {
		if (input.evidenceFile) {
			evidence = await uploadFoodCompatibilityEvidence(
				userId,
				input.evidenceFile,
			);
		}
		const { error } = await admin
			.from("food_compatibility_feedback")
			.insert({
				reported_by: userId,
				policy_version_id: policyVersion.id,
				shared_product_id: product.sharedProductId,
				shared_product_revision_id: product.sharedProductRevisionId,
				source_key: product.sourceKey,
				source_id: product.sourceId,
				barcode: product.barcode,
				food_description: product.foodDescription,
				feedback_type: "missing_warning",
				warning_id: null,
				issue_code: null,
				issue_params: {},
				fact_snapshot: product.factSnapshot,
				preference_type: preference.ruleType,
				preference_value: preference.rawValue,
				preference_tag_id: preference.tag.id,
				observed_label_date: input.observedLabelDate,
				evidence_path: evidence?.path ?? null,
				evidence_sha256: evidence?.sha256 ?? null,
				report_reason: "missing_warning",
				report_details: input.reportDetails,
				report_fingerprint: reportFingerprint,
			});

		if (!error) return "submitted" as const;
		if (error.code === "23505") {
			await deleteFoodCompatibilityEvidence(evidence);
			return "already_pending" as const;
		}
		throw error;
	} catch (error) {
		await deleteFoodCompatibilityEvidence(evidence);
		throw error;
	}
};

export const listPendingFoodCompatibilityFeedback = async () => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("food_compatibility_feedback")
		.select(
			"id, reported_by, feedback_type, shared_product_id, shared_product_revision_id, source_key, source_id, barcode, food_description, warning_id, issue_code, issue_params, fact_snapshot, preference_type, preference_value, observed_label_date, evidence_path, report_reason, report_details, created_at, policy_version:food_compatibility_policy_versions(version_number)",
		)
		.eq("status", "pending")
		.order("created_at", { ascending: true });

	if (error) throw error;
	return Promise.all((data ?? []).map(async (feedback) => ({
		...feedback,
		evidence_signed_url: await createFoodCompatibilityEvidenceSignedUrl(
			feedback.evidence_path,
		),
	})));
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
