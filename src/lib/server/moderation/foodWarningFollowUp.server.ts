import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Json } from "$lib/types/database.types";

export type FoodWarningFollowUpCase = {
	id: string;
	caseType: "rule_review" | "source_correction";
	responsibleGroup: string;
	status: string;
	sourceKey: string | null;
	createdAt: string;
	resolutionNote: string | null;
	productName: string;
	barcode: string | null;
	feedbackType: string;
	preferenceType: string | null;
	preferenceValue: string | null;
	reportReason: string;
	reportDetails: string | null;
	issueCode: string | null;
	issueParams: Json;
	policyVersion: number | null;
	initialReviewStatus: string;
	initialResolutionAction: string;
	initialReviewNote: string | null;
	initialReviewedAt: string | null;
	facts: FoodWarningEvidenceFact[];
};

export type FoodWarningEvidenceFact = {
	label: string;
	factType: string;
	sourceType: string;
	sourceText: string | null;
	confidence: string;
};

const readEvidenceFacts = (value: Json): FoodWarningEvidenceFact[] => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return [];
	const facts = (value as { facts?: Json }).facts;
	if (!Array.isArray(facts)) return [];
	return facts.flatMap((fact) => {
		if (!fact || typeof fact !== "object" || Array.isArray(fact)) return [];
		const candidate = fact as Record<string, unknown>;
		if (
			typeof candidate.label !== "string" ||
			typeof candidate.factType !== "string" ||
			typeof candidate.sourceType !== "string" ||
			typeof candidate.confidence !== "string"
		) {
			return [];
		}
		return [
			{
				label: candidate.label,
				factType: candidate.factType,
				sourceType: candidate.sourceType,
				sourceText:
					typeof candidate.sourceText === "string"
						? candidate.sourceText
						: null,
				confidence: candidate.confidence,
			},
		];
	});
};

export const readFoodWarningFollowUpCase = async (
	caseId: string,
): Promise<FoodWarningFollowUpCase | null> => {
	const admin = getSupabaseAdminClient();
	const { data: reviewCase, error: caseError } = await admin
		.from("food_warning_policy_review_cases")
		.select(
			"id, feedback_id, case_type, responsible_group, shared_product_id, source_key, status, resolution_note, created_at",
		)
		.eq("id", caseId)
		.maybeSingle();
	if (caseError) throw caseError;
	if (!reviewCase) return null;

	const [feedbackResult, productResult] = await Promise.all([
		admin
			.from("food_compatibility_feedback")
			.select(
				"feedback_type, preference_type, preference_value, report_reason, report_details, issue_code, issue_params, fact_snapshot, status, resolution_action, review_note, reviewed_at, policy_version:food_compatibility_policy_versions(version_number)",
			)
			.eq("id", reviewCase.feedback_id)
			.maybeSingle(),
		reviewCase.shared_product_id
			? admin
					.from("shared_products")
					.select("product_name, barcode")
					.eq("id", reviewCase.shared_product_id)
					.maybeSingle()
			: Promise.resolve({ data: null, error: null }),
	]);
	if (feedbackResult.error || productResult.error) {
		throw feedbackResult.error ?? productResult.error;
	}
	if (!feedbackResult.data) return null;
	const policyValue = feedbackResult.data.policy_version;
	const policy = Array.isArray(policyValue) ? policyValue[0] : policyValue;

	return {
		id: reviewCase.id,
		caseType: reviewCase.case_type as "rule_review" | "source_correction",
		responsibleGroup: reviewCase.responsible_group,
		status: reviewCase.status,
		sourceKey: reviewCase.source_key,
		createdAt: reviewCase.created_at,
		resolutionNote: reviewCase.resolution_note,
		productName: productResult.data?.product_name ?? "Reported food",
		barcode: productResult.data?.barcode ?? null,
		feedbackType: feedbackResult.data.feedback_type,
		preferenceType: feedbackResult.data.preference_type,
		preferenceValue: feedbackResult.data.preference_value,
		reportReason: feedbackResult.data.report_reason,
		reportDetails: feedbackResult.data.report_details,
		issueCode: feedbackResult.data.issue_code,
		issueParams: feedbackResult.data.issue_params,
		policyVersion:
			policy && typeof policy.version_number === "number"
				? policy.version_number
				: null,
		initialReviewStatus: feedbackResult.data.status,
		initialResolutionAction: feedbackResult.data.resolution_action,
		initialReviewNote: feedbackResult.data.review_note,
		initialReviewedAt: feedbackResult.data.reviewed_at,
		facts: readEvidenceFacts(feedbackResult.data.fact_snapshot),
	};
};
