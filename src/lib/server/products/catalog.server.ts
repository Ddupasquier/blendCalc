import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { getNutrientDefinitionCatalog } from "$lib/server/nutrition/nutrientDefinitionCatalog.server";
import type { Database, Json } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import {
	createNutrientValueMapFromFood,
	readNutrientRelationshipRules,
	validateNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceFilters } from "$lib/utils/ingredients/ingredientProvenance";
import type { SharedProductSubmissionResult } from "$lib/utils/products/catalog";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import {
	compareCatalogSubmissionToExistingProduct,
	type CatalogSubmissionComparison,
} from "$lib/utils/products/catalogSubmissionComparison";
import {
	createCatalogUpdateSummary,
	readCatalogUpdateSummary,
} from "$lib/utils/products/catalogUpdateReview";
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
	recordAutoDeclinedCatalogSubmission,
} from "./catalogSubmissionRepository.server";
import {
	buildProductSubmissionReviewFlags,
	prepareCatalogSubmissionReview,
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
		this.displayBlockedUntil = formatBlockDate(suspension.sharing_suspended_until);
	}
}

const formatBlockDate = (value: string) =>
	new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));

export { buildProductSubmissionReviewFlags };

export const validateSharedProductFood = (
	food: FoodItem,
	nutrientRelationshipRules: NutrientRelationshipRule[] = [],
) => {
	const issues: string[] = [];
	const barcode = normalizeBarcode(food.barcode ?? food.gtinUpc ?? "");
	if (!barcode) issues.push("A valid GTIN barcode is required.");
	const productName = food.description?.trim() ?? "";
	const brandOwner = food.brandOwner?.trim() ?? "";
	if (!productName) issues.push("A product name is required.");
	if (productName.length > 120) {
		issues.push("Product name must be 120 characters or fewer.");
	}
	if (brandOwner.length > 120) {
		issues.push("Brand must be 120 characters or fewer.");
	}
	if (food.customFood === true) {
		issues.push(
			"Private custom foods cannot be submitted to the shared catalog.",
		);
	}
	if (!Array.isArray(food.foodNutrients) || food.foodNutrients.length === 0) {
		issues.push("At least one nutrition value is required.");
	}
	if ((food.foodNutrients?.length ?? 0) > 300) {
		issues.push("A product cannot contain more than 300 nutrition values.");
	}
	if (
		food.customServingWeightGrams !== undefined &&
		(!Number.isFinite(food.customServingWeightGrams) ||
			food.customServingWeightGrams <= 0)
	) {
		issues.push("Serving weight must be greater than zero.");
	}

	const nutrientIds = new Set<number>();
	for (const nutrient of food.foodNutrients ?? []) {
		if (
			!Number.isSafeInteger(nutrient.nutrientId) ||
			nutrient.nutrientId <= 0
		) {
			issues.push("Every nutrition value needs a valid nutrient identity.");
			continue;
		}
		if (nutrientIds.has(nutrient.nutrientId)) {
			issues.push(`${nutrient.nutrientName || "A nutrient"} is duplicated.`);
			continue;
		}
		nutrientIds.add(nutrient.nutrientId);
		if (!Number.isFinite(nutrient.value) || nutrient.value < 0) {
			issues.push(`${nutrient.nutrientName || "A nutrient"} has an invalid value.`);
		}
	}

	issues.push(
		...validateNutrientRelationshipRules(
			createNutrientValueMapFromFood(food),
			nutrientRelationshipRules,
		).map((issue) => issue.message),
	);

	return { barcode, issues, valid: issues.length === 0 };
};

export const getSharedProductByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
) => {
	const record = await getActiveCanonicalCatalogRecordByBarcode(
		supabase,
		barcode,
	);
	return record?.food ?? null;
};

export const searchApprovedSharedProducts = async (
	supabase: SupabaseClient<Database>,
	query: string,
	filters: IngredientProvenanceFilters = {},
) => {
	const records = await searchApprovedCatalogRecords(supabase, query, filters);
	return records.map((record) => record.food);
};

const assertKnownSubmissionNutrients = async (food: FoodItem) => {
	const nutrientIds = [
		...new Set(food.foodNutrients.map((nutrient) => nutrient.nutrientId)),
	];
	const knownIds = new Set(
		(await getNutrientDefinitionCatalog()).map(
			(definition) => definition.nutrient_id,
		),
	);
	const unknownIds = nutrientIds.filter((nutrientId) => !knownIds.has(nutrientId));
	if (unknownIds.length > 0) {
		throw new Error(
			`Unknown nutrient identifiers cannot be submitted: ${unknownIds.join(", ")}.`,
		);
	}
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
	const nutrientRelationshipRules = await readNutrientRelationshipRules(admin);
	if (!nutrientRelationshipRules?.length) {
		throw new Error("Nutrition validation rules are not configured.");
	}
	const validation = validateSharedProductFood(food, nutrientRelationshipRules);
	if (!validation.valid || !validation.barcode) {
		throw new Error(validation.issues.join(" "));
	}
	await assertKnownSubmissionNutrients(food);
	const selectedCategory = await resolveFoodCategoryOption(
		admin,
		food.categories ?? [],
	);
	if (!selectedCategory) {
		throw new Error("Please select a valid category for this ingredient.");
	}
	const submissionFood = applyCanonicalFoodCategory(food, selectedCategory);
	const submissionIntent = context.intent ?? "catalog_share";

	const existingCatalogFood = await getSharedProductByBarcode(admin, validation.barcode);
	const existingCatalogComparison = existingCatalogFood
		? compareCatalogSubmissionToExistingProduct(submissionFood, existingCatalogFood)
		: null;
	if (existingCatalogComparison?.matchesExisting) {
		return {
			status: "already-available",
			message: "This product is already available to everyone.",
			evidenceAccepted: false,
		};
	}
	const labelObservedAt = new Date().toISOString();
	const catalogUpdateTarget = existingCatalogFood?.sharedProductId && existingCatalogComparison
		? await readCatalogUpdateTarget(admin, existingCatalogFood.sharedProductId)
		: null;
	if (
		existingCatalogComparison?.shouldAutoDecline &&
		submissionIntent !== "catalog_correction"
	) {
		if (!catalogUpdateTarget) {
			throw new Error("The active catalog product could not be prepared for comparison.");
		}
		const changeSummary = createCatalogUpdateSummary({
			comparison: existingCatalogComparison,
			baseRevisionNumber: catalogUpdateTarget.baseRevisionNumber,
			observedAt: labelObservedAt,
			sourceChecks: [],
		});
		await recordAutoDeclinedCatalogSubmission(admin, {
			userId,
			barcode: validation.barcode,
			food: submissionFood,
			categoryOptionId: selectedCategory.categoryOptionId,
			comparison: existingCatalogComparison,
			updateTarget: catalogUpdateTarget,
			changeSummary,
			intent: submissionIntent,
		});
		return {
			status: "already-available",
			message: "This barcode already has a verified catalog item. Your private ingredient was saved, but it was not sent for shared review.",
			evidenceAccepted: false,
		};
	}

	const existingSubmission = await findPendingCatalogSubmission(
		admin,
		{
			barcode: validation.barcode,
			userId,
			updateTarget: catalogUpdateTarget,
		},
	);
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
	);
	const preparedReview = prepareCatalogSubmissionReview({
		submissionFood,
		selectedCategory,
		existingCatalogFood,
		existingComparison: existingCatalogComparison,
		updateTarget: catalogUpdateTarget,
		sourceAssessment,
		evidencePaths,
		requestedReviewFlags: context.reviewFlags,
		frontImageCrop: context.frontImageCrop,
		labelObservedAt,
	});
	if (
		preparedReview.sourceMismatchName &&
		submissionIntent !== "catalog_correction"
	) {
		return {
			status: "source-mismatch",
			message:
				`This barcode belongs to “${preparedReview.sourceMismatchName}”. Your ingredient was saved privately, but it was not shared.`,
			evidenceAccepted: false,
		};
	}
	const {
		canonicalCategory,
		canonicalSubmissionFood,
		catalogUpdateSummary,
		evidenceComplete,
		hasSourceMatchedImageEvidence,
		matchedDraft,
		needsSourceComparisonReview,
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
		matchedSource: matchedDraft?.source === "open-food-facts"
			? "open-food-facts"
			: matchedDraft?.source === "usda"
				? "usda"
				: null,
		matchedReference: matchedDraft?.sourceReference,
		report,
		evidencePaths,
		evidenceComplete,
		intent: submissionIntent,
	});
	if (!submissionId) {
		return {
			status: "pending",
			message: "This product is already waiting for review.",
			evidenceAccepted: false,
		};
	}

	if (matchedDraft && !needsSourceComparisonReview && !hasSourceMatchedImageEvidence) {
		if (!verificationBundle) {
			throw new Error("Product verification could not be prepared.");
		}
		const source = matchedDraft.source === "open-food-facts"
			? "open-food-facts"
			: "usda";
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
			});
		} catch (publishError) {
			await admin.from("shared_product_submissions").delete().eq("id", submissionId);
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
		.select("id, barcode, product_name, brand_owner, category_option_id, food, status, evidence_complete, evidence_paths, validation_report, submission_kind, target_shared_product_id, change_summary")
		.eq("id", submissionId)
		.single();
	if (error || !submission) throw error ?? new Error("Submission not found.");
	if (submission.status !== "pending") {
		throw new Error("This product submission has already been reviewed.");
	}
	if (!submission.evidence_complete) {
		throw new Error("Complete label evidence is required before approval.");
	}

	const submittedFood = normalizeFoodForStorage(submission.food as unknown as FoodItem);
	const category =
		await readFoodCategoryOption(admin, submission.category_option_id)
		?? await resolveFoodCategoryOption(admin, submittedFood.categories ?? []);
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
		throw new Error("The active catalog product could not be loaded for this update.");
	}
	const changes = parsedUpdateSummary?.changes ?? [];
	if (submission.submission_kind === "product_update" && changes.length === 0) {
		throw new Error("The catalog update does not include any reviewable changes.");
	}
	const verificationBundle =
		submission.submission_kind === "product_update" && currentFood
			? buildModeratorReviewedCatalogUpdateBundle(
					currentFood,
					categorizedFood,
					changes,
				)
			: buildModeratorReviewedCatalogBundle(categorizedFood);
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
