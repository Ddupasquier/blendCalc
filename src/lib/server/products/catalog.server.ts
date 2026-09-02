import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database, Json } from "$lib/types/database.types";
import {
	getBarcodeLookupCandidates,
	normalizeBarcode,
} from "$lib/utils/barcode/barcode";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceFilters } from "$lib/utils/ingredients/ingredientProvenance";
import type { SharedProductSubmissionResult } from "$lib/utils/products/catalog";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import {
	validateCatalogIntakeIdentity,
	type CatalogIntakeIdentityRecord,
} from "$lib/utils/products/catalogIntakeIdentity";
import { compareCatalogSubmissionToExistingProduct } from "$lib/utils/products/catalogSubmissionComparison";
import { readCatalogUpdateSummary } from "$lib/utils/products/catalogUpdateReview";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	buildModeratorReviewedCatalogBundle,
	buildModeratorReviewedCatalogUpdateBundle,
} from "./catalogVerification.server";
import { readCatalogUpdateTarget } from "./catalogUpdateReview.server";
import {
	applyCanonicalFoodCategory,
	readFoodCategoryOption,
	resolveFoodCategoryOption,
} from "./categoryMapping.server";
import { assessCatalogProductSources } from "./catalogSourceAssessment.server";
import { publishCatalogSubmission } from "./catalogPublishing.server";
import {
	createCatalogSubmission,
	findPendingCatalogSubmission,
} from "./catalogSubmissionRepository.server";
import {
	buildProductSubmissionReviewFlags,
	prepareCatalogSubmissionReview,
	resolveCatalogSubmissionIntent,
	type CatalogSubmissionValidationReport,
} from "./catalogSubmissionReview.server";
import {
	createProductEvidenceSignedUrlBatches,
	type ProductEvidencePaths,
} from "./productEvidence.server";
import {
	persistFoodImageAsset,
	publishModeratedFoodImageAsset,
	type FoodImagePlacementValues,
} from "./foodImages.server";
import {
	getActiveCanonicalCatalogRecordByBarcode,
	searchApprovedCatalogRecords,
} from "./catalogRead.server";
import { getDefaultProductResolutionPolicy } from "./productResolutionPolicy.server";
import {
	assertSharedProductFoodCanBePublished,
	validateSharedProductFood,
} from "./catalogFoodValidation.server";
import { recordProductSourceFieldMetrics } from "./sourceMetrics.server";
import { getProductReferenceCatalog } from "./productReferenceCatalog.server";
import { barcodeDraftUsesOnlyCanonicalSources } from "$lib/utils/products/catalogSourcePolicy";

type ProductSubmissionContext = {
	reviewFlags?: string[];
	frontImageCrop?: FoodImagePlacementValues | null;
	intent?: CatalogSubmissionIntent;
};

type PendingProductSubmission = {
	id: string;
	submitted_by: string;
	barcode: string;
	product_name: string;
	brand_owner: string | null;
	category_option_id: string | null;
	food: Json;
	matched_source: string | null;
	matched_reference: string | null;
	validation_report: Json;
	evidence_paths: Json;
	evidence_complete: boolean;
	submission_kind: string;
	target_shared_product_id: string | null;
	base_revision_id: string | null;
	change_summary: Json;
	submission_intent: string;
	label_observed_at: string;
	created_at: string;
};

type CatalogSubmissionSuspension = {
	sharing_suspended_until: string;
	moderator_rejection_count: number;
};

export class ProductSubmissionBlockedError extends Error {
	status = 429;
	blockedUntil: string;
	displayBlockedUntil: string;

	constructor(suspension: CatalogSubmissionSuspension) {
		super("Catalog product submission is blocked.");
		this.name = "ProductSubmissionBlockedError";
		this.blockedUntil = suspension.sharing_suspended_until;
		this.displayBlockedUntil = formatBlockDate(
			suspension.sharing_suspended_until,
		);
	}
}

const formatBlockDate = (value: string) =>
	new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));

export { buildProductSubmissionReviewFlags, resolveCatalogSubmissionIntent };

export { validateSharedProductFood };

export const getSharedProductByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
) => {
	const canonicalCandidates = new Set(
		getBarcodeLookupCandidates(barcode)
			.map((candidate) => normalizeBarcode(candidate))
			.filter((candidate): candidate is string => Boolean(candidate)),
	);
	for (const candidate of canonicalCandidates) {
		const record = await getActiveCanonicalCatalogRecordByBarcode(
			supabase,
			candidate,
		);
		if (record) return record.food;
	}
	return null;
};

export const searchApprovedSharedProducts = async (
	supabase: SupabaseClient<Database>,
	query: string,
	filters: IngredientProvenanceFilters = {},
) => {
	const records = await searchApprovedCatalogRecords(supabase, query, filters);
	return records.map((record) => record.food);
};

export const getActiveCatalogSubmissionSuspension = async (userId: string) => {
	const admin = getSupabaseAdminClient();
	const now = new Date().toISOString();
	const { data, error } = await admin
		.from("user_catalog_submission_enforcement")
		.select("sharing_suspended_until, moderator_rejection_count")
		.eq("user_id", userId)
		.gt("sharing_suspended_until", now)
		.maybeSingle();
	if (error) throw error;
	return data;
};

export const assertCanSubmitSharedProduct = async (userId: string) => {
	const activeSuspension = await getActiveCatalogSubmissionSuspension(userId);
	if (activeSuspension?.sharing_suspended_until) {
		throw new ProductSubmissionBlockedError({
			sharing_suspended_until: activeSuspension.sharing_suspended_until,
			moderator_rejection_count: activeSuspension.moderator_rejection_count,
		});
	}
};

export const submitProductForCatalog = async (
	userId: string,
	food: FoodItem,
	evidencePaths: ProductEvidencePaths = {},
	context: ProductSubmissionContext = {},
): Promise<SharedProductSubmissionResult> => {
	await assertCanSubmitSharedProduct(userId);

	const admin = getSupabaseAdminClient();
	const validation = await assertSharedProductFoodCanBePublished(admin, food);
	const nutrientRelationshipRules = validation.nutrientRelationshipRules;
	if (!validation.barcode) {
		throw new Error("A valid GTIN barcode is required.");
	}
	const selectedCategory = await resolveFoodCategoryOption(
		admin,
		food.categories ?? [],
	);
	if (!selectedCategory) {
		throw new Error("Please select a valid category for this ingredient.");
	}
	const submissionFood = applyCanonicalFoodCategory(food, selectedCategory);
	const submissionIntent = context.intent ?? "catalog_share";

	const [existingCatalogFood, resolutionPolicy, productReferenceCatalog] =
		await Promise.all([
			getSharedProductByBarcode(admin, validation.barcode),
			getDefaultProductResolutionPolicy(),
			getProductReferenceCatalog(),
		]);
	const existingCatalogComparison = existingCatalogFood
		? compareCatalogSubmissionToExistingProduct(
				submissionFood,
				existingCatalogFood,
				resolutionPolicy,
			)
		: null;
	if (existingCatalogComparison?.matchesExisting) {
		return {
			status: "already-available",
			message: "This product is already available to everyone.",
			evidenceAccepted: false,
		};
	}
	const labelObservedAt = new Date().toISOString();
	const catalogUpdateTarget =
		existingCatalogFood?.sharedProductId && existingCatalogComparison
			? await readCatalogUpdateTarget(
					admin,
					existingCatalogFood.sharedProductId,
				)
			: null;
	const effectiveSubmissionIntent = resolveCatalogSubmissionIntent({
		requestedIntent: submissionIntent,
		existingComparison: existingCatalogComparison,
	});

	const existingSubmission = await findPendingCatalogSubmission(admin, {
		barcode: validation.barcode,
		userId,
		updateTarget: catalogUpdateTarget,
	});
	if (existingSubmission) {
		return {
			status: "pending",
			message: "This product is already waiting for review.",
			evidenceAccepted: false,
		};
	}

	const sourceAssessment = await assessCatalogProductSources(
		admin,
		validation.barcode,
		{
			policy: resolutionPolicy,
			nutrientRelationshipRules,
		},
	);
	await recordProductSourceFieldMetrics(
		sourceAssessment.sourceAccuracy.metricIncrements,
	);
	const exactSourceRecords: CatalogIntakeIdentityRecord[] = [];
	if (sourceAssessment.usdaDraft) {
		exactSourceRecords.push({
			source: "usda",
			sourceReference: sourceAssessment.usdaDraft.sourceReference ?? null,
			productName: sourceAssessment.usdaDraft.name,
			brandOwner: sourceAssessment.usdaDraft.brandOwner || null,
		});
	}
	if (sourceAssessment.openFoodFactsDraft) {
		exactSourceRecords.push({
			source: "open-food-facts",
			sourceReference:
				sourceAssessment.openFoodFactsDraft.sourceReference ?? null,
			productName: sourceAssessment.openFoodFactsDraft.name,
			brandOwner: sourceAssessment.openFoodFactsDraft.brandOwner || null,
		});
	}
	const identityValidation = validateCatalogIntakeIdentity({
		submittedFood: submissionFood,
		canonicalRecord: existingCatalogFood
			? {
					source: "canonical",
					sourceReference: existingCatalogFood.sharedProductId ?? null,
					productName: existingCatalogFood.description,
					brandOwner: existingCatalogFood.brandOwner ?? null,
				}
			: null,
		exactSourceRecords,
		intent: submissionIntent,
		minimumRelatedNameTokenOverlap:
			sourceAssessment.resolutionPolicy.minimumRelatedNameTokenOverlap,
	});
	if (identityValidation.disposition === "reject") {
		return {
			status: "source-mismatch",
			message: `This barcode belongs to “${identityValidation.blockingRecord?.productName ?? "another product"}”. Your ingredient was saved privately, but it was not shared.`,
			evidenceAccepted: false,
		};
	}
	const preparedReview = prepareCatalogSubmissionReview({
		submissionFood,
		selectedCategory,
		existingCatalogFood,
		existingComparison: existingCatalogComparison,
		updateTarget: catalogUpdateTarget,
		sourceAssessment,
		identityValidation,
		evidencePaths,
		requestedReviewFlags: context.reviewFlags,
		frontImageCrop: context.frontImageCrop,
		labelObservedAt,
		sourceCanAutoPublish: Boolean(
			sourceAssessment.mergedDraft &&
			barcodeDraftUsesOnlyCanonicalSources(
				sourceAssessment.mergedDraft,
				productReferenceCatalog,
			),
		),
	});
	await recordProductSourceFieldMetrics(
		preparedReview.report.sourceLabelDisagreementMetrics ?? [],
	);
	const {
		canonicalCategory,
		canonicalSubmissionFood,
		catalogUpdateSummary,
		evidenceComplete,
		hasSourceMatchedImageEvidence,
		matchedDraft,
		needsSourceComparisonReview,
		sourceCanAutoPublish,
		report,
		verificationBundle,
	} = preparedReview;

	const submissionId = await createCatalogSubmission(admin, {
		userId,
		barcode: validation.barcode,
		categoryOptionId: canonicalCategory.categoryOptionId,
		food: canonicalSubmissionFood,
		updateTarget: catalogUpdateTarget,
		updateSummary: catalogUpdateSummary,
		labelObservedAt,
		hasExactSourceMatch: Boolean(matchedDraft && !needsSourceComparisonReview),
		matchedSource:
			matchedDraft?.source === "open-food-facts"
				? "open-food-facts"
				: matchedDraft?.source === "usda"
					? "usda"
					: null,
		matchedReference: matchedDraft?.sourceReference,
		report,
		evidencePaths,
		evidenceComplete,
		intent: effectiveSubmissionIntent,
	});
	if (!submissionId) {
		return {
			status: "pending",
			message: "This product is already waiting for review.",
			evidenceAccepted: false,
		};
	}

	if (
		matchedDraft &&
		sourceCanAutoPublish &&
		!needsSourceComparisonReview &&
		!hasSourceMatchedImageEvidence
	) {
		if (!verificationBundle) {
			throw new Error("Product verification could not be prepared.");
		}
		const source =
			matchedDraft.source === "open-food-facts" ? "open-food-facts" : "usda";
		try {
			const sharedProductId = await publishCatalogSubmission({
				submissionId,
				food: verificationBundle.canonicalFood,
				productName: matchedDraft.name,
				brandOwner: matchedDraft.brandOwner,
				source,
				sourceReference: matchedDraft.sourceReference,
				confidence: "imported",
				observations: verificationBundle.observations,
				provenance: verificationBundle.provenance,
				conflicts: verificationBundle.conflicts,
			});
			await persistFoodImageAsset({
				image: matchedDraft.image,
				barcode: validation.barcode,
				sharedProductId,
				productName: matchedDraft.name,
				brandName: matchedDraft.brandOwner,
			});
		} catch (publishError) {
			await admin
				.from("shared_product_submissions")
				.delete()
				.eq("id", submissionId);
			throw publishError;
		}
		return {
			status: "approved",
			message:
				"An exact barcode match confirmed the product identity, so it is now available to everyone.",
			evidenceAccepted: true,
		};
	}

	return {
		status: "pending",
		message: hasSourceMatchedImageEvidence
			? "The ingredient was saved privately. The product image is waiting for moderator review before it can be shared."
			: needsSourceComparisonReview
				? "The product is saved privately and is waiting for a source comparison review."
				: "The product is saved privately and is waiting for a label review.",
		evidenceAccepted: true,
	};
};

export const listPendingProductSubmissions = async () => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("shared_product_submissions")
		.select(
			"id, submitted_by, barcode, product_name, brand_owner, category_option_id, food, matched_source, matched_reference, validation_report, evidence_paths, evidence_complete, submission_kind, target_shared_product_id, base_revision_id, change_summary, submission_intent, label_observed_at, created_at",
		)
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(100);
	if (error) throw error;
	const submissions = (data ?? []) as PendingProductSubmission[];
	const signedUrlGroups = await createProductEvidenceSignedUrlBatches(
		submissions.map(
			(submission) => submission.evidence_paths as ProductEvidencePaths,
		),
	);
	return submissions.map((submission, index) => ({
		...submission,
		evidenceUrls: signedUrlGroups[index] ?? {},
	}));
};

export const approveCommunityProductSubmission = async (
	submissionId: string,
	moderatorId: string,
	imageCrop?: FoodImagePlacementValues,
) => {
	const admin = getSupabaseAdminClient();
	const { data: submission, error } = await admin
		.from("shared_product_submissions")
		.select(
			"id, barcode, product_name, brand_owner, category_option_id, food, status, evidence_complete, evidence_paths, validation_report, submission_kind, target_shared_product_id, change_summary",
		)
		.eq("id", submissionId)
		.single();
	if (error || !submission) throw error ?? new Error("Submission not found.");
	if (submission.status !== "pending") {
		throw new Error("This product submission has already been reviewed.");
	}
	if (!submission.evidence_complete) {
		throw new Error("Complete label evidence is required before approval.");
	}

	const submittedFood = normalizeFoodForStorage(
		submission.food as unknown as FoodItem,
	);
	const category =
		(await readFoodCategoryOption(admin, submission.category_option_id)) ??
		(await resolveFoodCategoryOption(admin, submittedFood.categories ?? []));
	if (!category) {
		throw new Error(
			"Select a canonical food category before approving this product.",
		);
	}
	if (submission.category_option_id !== category.categoryOptionId) {
		const { error: categoryError } = await admin
			.from("shared_product_submissions")
			.update({ category_option_id: category.categoryOptionId })
			.eq("id", submissionId);
		if (categoryError) throw categoryError;
	}
	const categorizedFood = applyCanonicalFoodCategory(submittedFood, category);
	categorizedFood.customFood = false;
	categorizedFood.dataType = "Shared Product";
	categorizedFood.barcodeSource = "community";
	categorizedFood.sharedProductConfidence = "moderator-reviewed";
	const parsedUpdateSummary = readCatalogUpdateSummary(
		submission.change_summary,
	);
	const currentFood = submission.target_shared_product_id
		? await getSharedProductByBarcode(admin, submission.barcode)
		: null;
	if (submission.submission_kind === "product_update" && !currentFood) {
		throw new Error(
			"The active catalog product could not be loaded for this update.",
		);
	}
	const changes = parsedUpdateSummary?.changes ?? [];
	if (submission.submission_kind === "product_update" && changes.length === 0) {
		throw new Error(
			"The catalog update does not include any reviewable changes.",
		);
	}
	const verificationBundle =
		submission.submission_kind === "product_update" && currentFood
			? buildModeratorReviewedCatalogUpdateBundle(
					currentFood,
					categorizedFood,
					changes,
					`catalog-submission:${submissionId}`,
				)
			: buildModeratorReviewedCatalogBundle(
					categorizedFood,
					`catalog-submission:${submissionId}`,
				);
	const sharedProductId = await publishCatalogSubmission({
		submissionId,
		food: verificationBundle.canonicalFood,
		productName: verificationBundle.canonicalFood.description,
		brandOwner: verificationBundle.canonicalFood.brandOwner,
		source: "community-reviewed",
		confidence: "moderator-reviewed",
		approvedBy: moderatorId,
		observations: verificationBundle.observations,
		provenance: verificationBundle.provenance,
		conflicts: verificationBundle.conflicts,
	});
	const evidencePaths = submission.evidence_paths as ProductEvidencePaths;
	const validationReport =
		submission.validation_report as CatalogSubmissionValidationReport;
	await recordProductSourceFieldMetrics(
		(validationReport.sourceLabelDisagreementMetrics ?? []).map((metric) => ({
			sourceKey: metric.sourceKey,
			fieldPath: metric.fieldPath,
			confirmedLabelCorrectionCount:
				metric.submittedLabelDisagreementCount ?? 0,
		})),
	);
	if (evidencePaths.front) {
		await publishModeratedFoodImageAsset({
			barcode: submission.barcode,
			sharedProductId,
			evidencePath: evidencePaths.front,
			moderatorId,
			crop: {
				...validationReport.imageCrop,
				...imageCrop,
				cropSource: "moderator",
			},
		});
	}
	return sharedProductId;
};

export const rejectProductSubmission = async (
	submissionId: string,
	moderatorId: string,
	reviewNote: string,
) => {
	const admin = getSupabaseAdminClient();
	const { data: rejectedSubmission, error } = await admin
		.from("shared_product_submissions")
		.update({
			status: "rejected",
			verification_status: "manual_review",
			reviewed_by: moderatorId,
			reviewed_at: new Date().toISOString(),
			review_note: reviewNote.slice(0, 1000),
		})
		.eq("id", submissionId)
		.eq("status", "pending")
		.select("id")
		.maybeSingle();
	if (error) throw error;
	if (!rejectedSubmission) {
		throw new Error("This product submission has already been reviewed.");
	}
};
