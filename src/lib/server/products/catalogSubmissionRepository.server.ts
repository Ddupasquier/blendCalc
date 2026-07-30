import type { Database } from "$lib/types/database.types";
import { compactManagedFood } from "$lib/utils/food/records/foodRecords";
import type { FdcFood } from "$lib/utils/food/types";
import type { CatalogSubmissionComparison } from "$lib/utils/products/catalogSubmissionComparison";
import type { CatalogUpdateSummary } from "$lib/utils/products/catalogUpdateReview";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import { toJson } from "$lib/utils/storage/supabase/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogUpdateTarget } from "./catalogUpdateReview.server";
import type { ProductEvidencePaths } from "./productEvidence.server";
import type { CatalogSubmissionValidationReport } from "./catalogSubmissionReview.server";

export const findPendingCatalogSubmission = async (
	supabase: SupabaseClient<Database>,
	input: {
		barcode: string;
		userId: string;
		updateTarget: CatalogUpdateTarget | null;
	},
) => {
	let query = supabase
		.from("shared_product_submissions")
		.select("id")
		.eq("barcode", input.barcode)
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(1);
	query = input.updateTarget
		? query
				.eq("submission_kind", "product_update")
				.eq("submitted_by", input.userId)
				.eq("base_revision_id", input.updateTarget.baseRevisionId)
		: query.eq("submission_kind", "new_product");
	const { data, error } = await query.maybeSingle();
	if (error) throw error;
	return data;
};

export const recordAutoDeclinedCatalogSubmission = async (
	supabase: SupabaseClient<Database>,
	input: {
		userId: string;
		barcode: string;
		food: FdcFood;
		categoryOptionId: string;
		comparison: CatalogSubmissionComparison;
		updateTarget: CatalogUpdateTarget;
		changeSummary: CatalogUpdateSummary;
		intent: CatalogSubmissionIntent;
	},
) => {
	const now = new Date().toISOString();
	const normalizedFood = compactManagedFood(input.food);
	const report: CatalogSubmissionValidationReport = {
		valid: false,
		issues: input.comparison.severeDifferences.length
			? input.comparison.severeDifferences
			: input.comparison.issues,
		existingCatalogMatch: true,
		existingCatalogAction: "auto_declined",
		existingCatalogComparison: input.comparison,
		evidenceComplete: false,
	};
	const { error } = await supabase
		.from("shared_product_submissions")
		.insert({
			submitted_by: input.userId,
			barcode: input.barcode,
			category_option_id: input.categoryOptionId,
			product_name: normalizedFood.description,
			brand_owner: input.food.brandOwner?.trim() || null,
			food: toJson(normalizedFood),
			consent_to_share: true,
			status: "auto_declined",
			verification_status: "manual_review",
			submission_kind: "product_update",
			target_shared_product_id: input.updateTarget.sharedProductId,
			base_revision_id: input.updateTarget.baseRevisionId,
			change_summary: toJson(input.changeSummary),
			submission_intent: input.intent,
			label_observed_at: input.changeSummary.observedAt,
			validation_report: toJson(report),
			evidence_paths: toJson({}),
			evidence_complete: false,
			reviewed_at: now,
			review_note:
				"Machine blocked: submitted product data is wildly different from the active catalog product for this barcode.",
		});
	if (error) throw error;
};

export const createCatalogSubmission = async (
	supabase: SupabaseClient<Database>,
	input: {
		userId: string;
		barcode: string;
		categoryOptionId: string;
		food: FdcFood;
		updateTarget: CatalogUpdateTarget | null;
		updateSummary: CatalogUpdateSummary | null;
		labelObservedAt: string;
		hasExactSourceMatch: boolean;
		matchedSource: "usda" | "open-food-facts" | null;
		matchedReference?: string;
		report: CatalogSubmissionValidationReport;
		evidencePaths: ProductEvidencePaths;
		evidenceComplete: boolean;
		intent: CatalogSubmissionIntent;
	},
) => {
	const normalizedFood = compactManagedFood(input.food);
	const { data, error } = await supabase
		.from("shared_product_submissions")
		.insert({
			submitted_by: input.userId,
			barcode: input.barcode,
			category_option_id: input.categoryOptionId,
			product_name: normalizedFood.description,
			brand_owner: input.food.brandOwner?.trim() || null,
			food: toJson(normalizedFood),
			submission_kind: input.updateSummary ? "product_update" : "new_product",
			target_shared_product_id: input.updateTarget?.sharedProductId ?? null,
			base_revision_id: input.updateTarget?.baseRevisionId ?? null,
			change_summary: toJson(input.updateSummary ?? {}),
			submission_intent: input.intent,
			label_observed_at: input.labelObservedAt,
			consent_to_share: true,
			verification_status: input.hasExactSourceMatch
				? "exact_identity"
				: "manual_review",
			matched_source: input.matchedSource,
			matched_reference: input.matchedReference ?? null,
			validation_report: toJson(input.report),
			evidence_paths: toJson(input.evidencePaths),
			evidence_complete: input.evidenceComplete,
		})
		.select("id")
		.single();
	if (error?.code === "23505") return null;
	if (error || !data) {
		throw error ?? new Error("Product submission could not be saved.");
	}
	return data.id;
};
