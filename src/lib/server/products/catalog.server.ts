import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { Database, Json } from "$lib/types/database.types";
import { normalizeBarcode } from "$lib/utils/barcode/barcode";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import { compactFood } from "$lib/utils/food/records/foodRecords";
import type { FoodCompatibilitySummary } from "$lib/utils/food/quality/compatibility";
import {
	hydrateFoodWithNormalizedNutrients,
	type NormalizedNutrientRow,
} from "$lib/utils/food/nutrients/normalizedNutrients";
import {
	createNutrientValueMapFromFood,
	readNutrientRelationshipRules,
	validateNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceFilters } from "$lib/utils/ingredients/ingredientProvenance";
import { hydrateFoodWithNormalizedServings } from "$lib/utils/food/servings/normalizedServings";
import { tokenizeIngredientSearchText } from "$lib/utils/ingredients/ingredientSearchRelevance";
import type { SharedProductSubmissionResult } from "$lib/utils/products/catalog";
import {
	compareCatalogSubmissionToExistingProduct,
	type CatalogSubmissionComparison,
} from "$lib/utils/products/catalogSubmissionComparison";
import {
	createCatalogUpdateSourceCheck,
	createCatalogUpdateSummary,
	type CatalogUpdateSummary,
} from "$lib/utils/products/catalogUpdateReview";
import { toJson } from "$lib/utils/storage/supabase/shared";
import { readNormalizedNutrientsByParent } from "$lib/utils/storage/supabase/normalizedNutrients";
import { readFoodServingsByParent } from "$lib/utils/storage/supabase/servings";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	buildOpenFoodFactsCatalogBundle,
	buildModeratorReviewedCatalogBundle,
	buildUsdaVerifiedCatalogBundle,
	type CatalogConflict,
	type CatalogFieldProvenance,
	type CatalogObservation,
} from "./catalogVerification.server";
import { createCatalogFoodFromDraft } from "./catalogFood.server";
import {
	readCatalogUpdateTarget,
	type CatalogUpdateTarget,
} from "./catalogUpdateReview.server";
import {
	applyCanonicalFoodCategory,
	readFoodCategoryOption,
	readFoodCategoryOptions,
	resolveBarcodeDraftCategory,
	resolveFoodCategoryOption,
	type ResolvedFoodCategory,
} from "./categoryMapping.server";
import {
	lookupOpenFoodFactsBarcodeProduct,
	lookupUsdaBarcodeProduct,
} from "./externalProduct.server";
import {
	createProductEvidenceSignedUrlBatches,
	hasCompleteProductEvidence,
	type ProductEvidencePaths,
} from "./productEvidence.server";
import {
	persistFoodImageAsset,
	publishModeratedFoodImageAsset,
	type FoodImagePlacementValues,
} from "./foodImages.server";

type CatalogSource = "usda" | "open-food-facts" | "community-reviewed";
type CatalogConfidence =
	| "source-verified"
	| "moderator-reviewed"
	| "corroborated"
	| "imported";

type ValidationReport = {
	valid: boolean;
	issues: string[];
	usdaMatch?: boolean;
	openFoodFactsMatch?: boolean;
	externalLookupFailed?: boolean;
	evidenceComplete?: boolean;
	conflictCount?: number;
	existingCatalogMatch?: boolean;
	existingCatalogAction?: "already_available" | "update_review" | "auto_declined";
	existingCatalogComparison?: CatalogSubmissionComparison;
	imageCrop?: FoodImagePlacementValues | null;
};

type ProductSubmissionContext = {
	reviewFlags?: string[];
	frontImageCrop?: FoodImagePlacementValues | null;
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
	label_observed_at: string;
	created_at: string;
};

const PRODUCT_SUBMISSION_REJECTION_THRESHOLD = 5;
const PRODUCT_SUBMISSION_REJECTION_WINDOW_DAYS = 30;
const PRODUCT_SUBMISSION_BLOCK_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT = 100;

type ProductSubmissionBlock = {
	blocked_until: string;
	rejection_count: number;
};

export class ProductSubmissionBlockedError extends Error {
	status = 429;
	blockedUntil: string;

	constructor(block: ProductSubmissionBlock) {
		const blockedUntil = formatBlockDate(block.blocked_until);
		super(
			`Product sharing is paused until ${blockedUntil} because this account has ${block.rejection_count} rejected submissions in the last ${PRODUCT_SUBMISSION_REJECTION_WINDOW_DAYS} days. You can still save foods privately.`,
		);
		this.name = "ProductSubmissionBlockedError";
		this.blockedUntil = block.blocked_until;
	}
}

const addDays = (date: Date, days: number) =>
	new Date(date.getTime() + days * DAY_IN_MS);

const formatBlockDate = (value: string) =>
	new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(value));

const sanitizeReviewFlags = (reviewFlags: string[] = []) =>
	Array.from(
		new Set(
			reviewFlags
				.map((flag) => flag.trim())
				.filter(Boolean)
				.map((flag) => flag.slice(0, 1000)),
		),
	).slice(0, 10);

export const validateSharedProductFood = (
	food: FdcFood,
	nutrientRelationshipRules: NutrientRelationshipRule[] = [],
) => {
	const issues: string[] = [];
	const barcode = normalizeBarcode(food.barcode ?? food.gtinUpc ?? "");
	if (!barcode) issues.push("A valid GTIN barcode is required.");
	if (!food.description?.trim()) issues.push("A product name is required.");
	if (!Array.isArray(food.foodNutrients) || food.foodNutrients.length === 0) {
		issues.push("At least one nutrition value is required.");
	}
	if (
		food.customServingWeightGrams !== undefined &&
		(!Number.isFinite(food.customServingWeightGrams) ||
			food.customServingWeightGrams <= 0)
	) {
		issues.push("Serving weight must be greater than zero.");
	}

	for (const nutrient of food.foodNutrients ?? []) {
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

const enrichCatalogFood = (
	row: {
		category_option_id?: string | null;
		compatibility_summary?: Json;
		id: string;
		food: Json;
		confidence: string;
	},
	nutrientRows?: NormalizedNutrientRow[],
	category?: ResolvedFoodCategory,
	servingRows?: Parameters<typeof hydrateFoodWithNormalizedServings>[1],
) => {
	const baseFood = {
		...(row.food as unknown as FdcFood),
		categoryOptionId: row.category_option_id ?? undefined,
		compatibilitySummary:
			(row.compatibility_summary as FoodCompatibilitySummary | null) ?? undefined,
		sharedProductId: row.id,
		sharedProductConfidence:
			row.confidence as FdcFood["sharedProductConfidence"],
		customFood: false,
	};
	const food = category
		? applyCanonicalFoodCategory(baseFood, category)
		: baseFood;
	const foodWithNutrients = hydrateFoodWithNormalizedNutrients(
		food,
		nutrientRows,
	);
	return hydrateFoodWithNormalizedServings(foodWithNutrients, servingRows);
};

export const getSharedProductByBarcode = async (
	supabase: SupabaseClient<Database>,
	barcode: string,
) => {
	const canonicalBarcode = normalizeBarcode(barcode);
	if (!canonicalBarcode) return null;

	const { data, error } = await supabase
		.from("shared_products")
		.select("id, food, confidence, compatibility_summary, category_option_id")
		.eq("barcode", canonicalBarcode)
		.eq("status", "active")
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	const [category, normalizedRows, servingRows] = await Promise.all([
		readFoodCategoryOption(supabase, data.category_option_id),
		readNormalizedNutrientsByParent(supabase, "shared_product_id", [data.id]),
		readFoodServingsByParent(supabase, "shared_product_id", [data.id]),
	]);
	return enrichCatalogFood(
		data,
		normalizedRows?.get(data.id),
		category ?? undefined,
		servingRows?.get(data.id),
	);
};

export const searchApprovedSharedProducts = async (
	supabase: SupabaseClient<Database>,
	query: string,
	filters: IngredientProvenanceFilters = {},
) => {
	const terms = tokenizeIngredientSearchText(query).slice(0, 6);
	if (terms.length === 0) return [];

	let request = supabase
		.from("shared_products")
		.select("id, food, confidence, compatibility_summary, category_option_id")
		.eq("status", "active")
		.order("product_name", { ascending: true })
		.limit(SHARED_PRODUCT_SEARCH_CANDIDATE_LIMIT);
	if (filters.sourceFilter === "usda") request = request.eq("source", "usda");
	if (filters.sourceFilter === "open-food-facts") {
		request = request.eq("source", "open-food-facts");
	}
	if (filters.sourceFilter === "shared-catalog") {
		request = request.eq("source", "community-reviewed");
	}
	if (filters.sourceFilter === "custom") return [];
	if (filters.trustFilter && filters.trustFilter !== "any") {
		request = request.eq("confidence", filters.trustFilter);
	}
	for (const term of terms) {
		request = request.ilike("search_text", `%${term}%`);
	}

	const { data, error } = await request;
	if (error) throw error;
	const rows = data ?? [];
	const [normalizedRows, servingRows, categories] = await Promise.all([
		readNormalizedNutrientsByParent(
			supabase,
			"shared_product_id",
			rows.map((row) => row.id),
		),
		readFoodServingsByParent(
			supabase,
			"shared_product_id",
			rows.map((row) => row.id),
		),
		readFoodCategoryOptions(
			supabase,
			rows.map((row) => row.category_option_id),
		),
	]);
	return rows.map((row) =>
		enrichCatalogFood(
			row,
			normalizedRows?.get(row.id),
			row.category_option_id
				? categories.get(row.category_option_id)
				: undefined,
			servingRows?.get(row.id),
		),
	);
};

const publishSubmission = async (input: {
	submissionId: string;
	food: FdcFood;
	productName: string;
	brandOwner?: string;
	source: CatalogSource;
	sourceReference?: string;
	confidence: CatalogConfidence;
	approvedBy?: string;
	observations: CatalogObservation[];
	provenance: CatalogFieldProvenance[];
	conflicts: CatalogConflict[];
}) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin.rpc("publish_shared_product_submission", {
		p_submission_id: input.submissionId,
		p_food: toJson(compactFood(input.food)),
		p_product_name: input.productName,
		p_brand_owner: input.brandOwner ?? "",
		p_source: input.source,
		p_source_reference: input.sourceReference ?? "",
		p_confidence: input.confidence,
		p_observations: toJson(input.observations),
		p_provenance: toJson(input.provenance),
		p_conflicts: toJson(input.conflicts),
		...(input.approvedBy ? { p_approved_by: input.approvedBy } : {}),
	});
	if (error) throw error;
	return data;
};

const findExistingPendingSubmission = async (barcode: string) => {
	const admin = getSupabaseAdminClient();
	const { data, error } = await admin
		.from("shared_product_submissions")
		.select("id")
		.eq("barcode", barcode)
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
};

const recordAutoDeclinedCatalogSubmission = async (input: {
	userId: string;
	barcode: string;
	food: FdcFood;
	categoryOptionId: string;
	comparison: CatalogSubmissionComparison;
	updateTarget: CatalogUpdateTarget;
	changeSummary: CatalogUpdateSummary;
}) => {
	const admin = getSupabaseAdminClient();
	const now = new Date().toISOString();
	const report: ValidationReport = {
		valid: false,
		issues: input.comparison.severeDifferences.length
			? input.comparison.severeDifferences
			: input.comparison.issues,
		existingCatalogMatch: true,
		existingCatalogAction: "auto_declined",
		existingCatalogComparison: input.comparison,
		evidenceComplete: false,
	};

	const { error } = await admin
		.from("shared_product_submissions")
		.insert({
			submitted_by: input.userId,
			barcode: input.barcode,
			category_option_id: input.categoryOptionId,
			product_name: input.food.description.trim(),
			brand_owner: input.food.brandOwner?.trim() || null,
			food: toJson(compactFood(input.food)),
			consent_to_share: true,
			status: "auto_declined",
			verification_status: "manual_review",
			submission_kind: "product_update",
			target_shared_product_id: input.updateTarget.sharedProductId,
			base_revision_id: input.updateTarget.baseRevisionId,
			change_summary: toJson(input.changeSummary),
			label_observed_at: input.changeSummary.observedAt,
			validation_report: toJson(report),
			evidence_paths: toJson({}),
			evidence_complete: false,
			reviewed_at: now,
			review_note: "Machine blocked: submitted product data is wildly different from the active catalog product for this barcode.",
		});
	if (error) throw error;
};

export const getActiveProductSubmissionBlock = async (userId: string) => {
	const admin = getSupabaseAdminClient();
	const now = new Date().toISOString();
	const { data, error } = await admin
		.from("product_submission_blocks")
		.select("blocked_until, rejection_count")
		.eq("user_id", userId)
		.gt("blocked_until", now)
		.order("blocked_until", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (error) throw error;
	return data;
};

const createProductSubmissionBlockIfNeeded = async (input: {
	userId: string;
	moderatorId?: string;
	sourceSubmissionId?: string;
}) => {
	const activeBlock = await getActiveProductSubmissionBlock(input.userId);
	if (activeBlock) return activeBlock;

	const admin = getSupabaseAdminClient();
	const now = new Date();
	const windowStartedAt = addDays(now, -PRODUCT_SUBMISSION_REJECTION_WINDOW_DAYS);
	const { data: recentRejections, error } = await admin
		.from("shared_product_submissions")
		.select("id, reviewed_at")
		.eq("submitted_by", input.userId)
		.eq("status", "rejected")
		.gte("reviewed_at", windowStartedAt.toISOString())
		.order("reviewed_at", { ascending: false })
		.limit(PRODUCT_SUBMISSION_REJECTION_THRESHOLD);
	if (error) throw error;
	if ((recentRejections?.length ?? 0) < PRODUCT_SUBMISSION_REJECTION_THRESHOLD) {
		return null;
	}

	const oldestCountedRejection = recentRejections?.at(-1)?.reviewed_at ?? windowStartedAt.toISOString();
	const blockedUntil = addDays(now, PRODUCT_SUBMISSION_BLOCK_DAYS).toISOString();
	const { data: block, error: blockError } = await admin
		.from("product_submission_blocks")
		.insert({
			user_id: input.userId,
			reason: "too_many_rejected_submissions",
			rejection_count: recentRejections?.length ?? PRODUCT_SUBMISSION_REJECTION_THRESHOLD,
			window_started_at: oldestCountedRejection,
			window_ended_at: now.toISOString(),
			blocked_until: blockedUntil,
			source_submission_id: input.sourceSubmissionId ?? null,
			created_by: input.moderatorId ?? null,
			notes: `${PRODUCT_SUBMISSION_REJECTION_THRESHOLD} rejected product submissions in ${PRODUCT_SUBMISSION_REJECTION_WINDOW_DAYS} days.`,
		})
		.select("blocked_until, rejection_count")
		.single();
	if (blockError || !block) {
		throw blockError ?? new Error("Product submission block could not be saved.");
	}
	return block;
};

export const assertCanSubmitSharedProduct = async (userId: string) => {
	const activeBlock = await getActiveProductSubmissionBlock(userId);
	if (activeBlock) throw new ProductSubmissionBlockedError(activeBlock);

	const newBlock = await createProductSubmissionBlockIfNeeded({ userId });
	if (newBlock) throw new ProductSubmissionBlockedError(newBlock);
};

export const submitProductForCatalog = async (
	userId: string,
	food: FdcFood,
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
	const selectedCategory = await resolveFoodCategoryOption(
		admin,
		food.categories ?? [],
	);
	if (!selectedCategory) {
		throw new Error("Please select a valid category for this ingredient.");
	}
	const submissionFood = applyCanonicalFoodCategory(food, selectedCategory);

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
	if (existingCatalogComparison?.shouldAutoDecline) {
		if (!catalogUpdateTarget) {
			throw new Error("The active catalog product could not be prepared for comparison.");
		}
		const changeSummary = createCatalogUpdateSummary({
			comparison: existingCatalogComparison,
			baseRevisionNumber: catalogUpdateTarget.baseRevisionNumber,
			observedAt: labelObservedAt,
			sourceChecks: [],
		});
		await recordAutoDeclinedCatalogSubmission({
			userId,
			barcode: validation.barcode,
			food: submissionFood,
			categoryOptionId: selectedCategory.categoryOptionId,
			comparison: existingCatalogComparison,
			updateTarget: catalogUpdateTarget,
			changeSummary,
		});
		return {
			status: "already-available",
			message: "This barcode already has a verified catalog item. Your private ingredient was saved, but it was not sent for shared review.",
			evidenceAccepted: false,
		};
	}

	const existingSubmission = await findExistingPendingSubmission(validation.barcode);
	if (existingSubmission) {
		return {
			status: "pending",
			message: "This product is already waiting for review.",
			evidenceAccepted: false,
		};
	}

	let usdaDraft: BarcodeProductDraft | null = null;
	let openFoodFactsDraft: BarcodeProductDraft | null = null;
	let usdaLookupStatus: "exact-match" | "not-found" | "error" = "not-found";
	let openFoodFactsLookupStatus: "exact-match" | "not-found" | "error" = "not-found";
	let externalLookupFailed = false;
	try {
		const draft = await lookupUsdaBarcodeProduct(validation.barcode);
		usdaDraft = draft
			? await resolveBarcodeDraftCategory(admin, draft)
			: null;
		usdaLookupStatus = usdaDraft ? "exact-match" : "not-found";
	} catch {
		usdaLookupStatus = "error";
		externalLookupFailed = true;
	}
	try {
		const draft = await lookupOpenFoodFactsBarcodeProduct(validation.barcode);
		openFoodFactsDraft = draft
			? await resolveBarcodeDraftCategory(admin, draft)
			: null;
		openFoodFactsLookupStatus = openFoodFactsDraft ? "exact-match" : "not-found";
	} catch {
		openFoodFactsLookupStatus = "error";
		externalLookupFailed = true;
	}

	const reviewFlags = sanitizeReviewFlags([
		...(context.reviewFlags ?? []),
		...(existingCatalogComparison
			? [
					"Barcode exists in the active shared catalog, but the submitted label data differs. Review as a catalog update request.",
					...existingCatalogComparison.issues,
				]
			: []),
	]);
	const needsSourceComparisonReview = reviewFlags.length > 0;
	const report: ValidationReport = {
		valid: true,
		issues: reviewFlags,
		usdaMatch: Boolean(usdaDraft),
		openFoodFactsMatch: Boolean(openFoodFactsDraft),
		externalLookupFailed,
		existingCatalogMatch: Boolean(existingCatalogComparison),
		existingCatalogAction: existingCatalogComparison ? "update_review" : undefined,
		existingCatalogComparison: existingCatalogComparison ?? undefined,
		imageCrop: context.frontImageCrop ?? null,
	};
	const matchedDraft = usdaDraft ?? openFoodFactsDraft;
	const canonicalCategory = existingCatalogComparison
		? selectedCategory
		: matchedDraft?.categoryResolution ?? selectedCategory;
	const canonicalSubmissionFood = applyCanonicalFoodCategory(
		submissionFood,
		canonicalCategory,
	);
	const sourceComparison = matchedDraft
		? compareCatalogSubmissionToExistingProduct(
				canonicalSubmissionFood,
				createCatalogFoodFromDraft(matchedDraft, canonicalCategory),
			)
		: null;
	if (!existingCatalogComparison && sourceComparison?.hasBlockingIdentityMismatch) {
		return {
			status: "source-mismatch",
			message:
				`This barcode belongs to “${matchedDraft?.name}”. Your ingredient was saved privately, but it was not shared.`,
			evidenceAccepted: false,
		};
	}
	const catalogUpdateSummary = existingCatalogComparison && existingCatalogFood && catalogUpdateTarget
		? createCatalogUpdateSummary({
				comparison: existingCatalogComparison,
				baseRevisionNumber: catalogUpdateTarget.baseRevisionNumber,
				observedAt: labelObservedAt,
				sourceChecks: [
					createCatalogUpdateSourceCheck({
						source: "usda",
						status: usdaLookupStatus,
						checkedAt: labelObservedAt,
						sourceReference: usdaDraft?.sourceReference,
						sourceFood: usdaDraft
							? createCatalogFoodFromDraft(usdaDraft, usdaDraft.categoryResolution ?? selectedCategory)
							: null,
						submittedFood: canonicalSubmissionFood,
						currentFood: existingCatalogFood,
					}),
					createCatalogUpdateSourceCheck({
						source: "open-food-facts",
						status: openFoodFactsLookupStatus,
						checkedAt: labelObservedAt,
						sourceReference: openFoodFactsDraft?.sourceReference,
						sourceFood: openFoodFactsDraft
							? createCatalogFoodFromDraft(
									openFoodFactsDraft,
									openFoodFactsDraft.categoryResolution ?? selectedCategory,
								)
							: null,
						submittedFood: canonicalSubmissionFood,
						currentFood: existingCatalogFood,
					}),
				],
			})
		: null;
	const hasSourceMatchedImageEvidence = Boolean(
		matchedDraft &&
			!needsSourceComparisonReview &&
			!canonicalSubmissionFood.image?.imageUrl &&
			evidencePaths.front,
	);

	const evidenceComplete = hasSourceMatchedImageEvidence
		? true
		: canonicalSubmissionFood.image?.imageUrl
			? Boolean(evidencePaths.nutrition && evidencePaths.barcode)
			: hasCompleteProductEvidence(evidencePaths);
	if (!matchedDraft && !evidenceComplete) {
		throw new Error(
			"Unknown products need front package, nutrition label, and barcode photos for verification.",
		);
	}
	if (needsSourceComparisonReview && !evidenceComplete) {
		throw new Error(
			"Source comparison reviews need front package, nutrition label, and barcode photos for verification.",
		);
	}
	const verificationBundle = usdaDraft
		? buildUsdaVerifiedCatalogBundle(
			canonicalSubmissionFood,
			usdaDraft,
			canonicalCategory,
		)
		: openFoodFactsDraft
			? buildOpenFoodFactsCatalogBundle(
				canonicalSubmissionFood,
				openFoodFactsDraft,
				canonicalCategory,
			)
			: null;
	report.evidenceComplete = evidenceComplete;
	report.conflictCount = verificationBundle?.conflicts.length ?? 0;

	const { data: submission, error: submissionError } = await admin
		.from("shared_product_submissions")
			.insert({
				submitted_by: userId,
				barcode: validation.barcode,
				category_option_id: canonicalCategory.categoryOptionId,
				product_name: canonicalSubmissionFood.description.trim(),
				brand_owner: canonicalSubmissionFood.brandOwner?.trim() || null,
				food: toJson(compactFood(canonicalSubmissionFood)),
				submission_kind: catalogUpdateSummary ? "product_update" : "new_product",
				target_shared_product_id: catalogUpdateTarget?.sharedProductId ?? null,
				base_revision_id: catalogUpdateTarget?.baseRevisionId ?? null,
				change_summary: toJson(catalogUpdateSummary ?? {}),
				label_observed_at: labelObservedAt,
				consent_to_share: true,
				verification_status: usdaDraft && !needsSourceComparisonReview
					? "source_verified"
					: "manual_review",
				matched_source: matchedDraft?.source === "open-food-facts"
					? "open-food-facts"
					: matchedDraft?.source === "usda"
						? "usda"
						: null,
				matched_reference: matchedDraft?.sourceReference ?? null,
				validation_report: toJson(report),
				evidence_paths: toJson(evidencePaths),
				evidence_complete: evidenceComplete,
		})
		.select("id")
		.single();
	if (submissionError || !submission) {
		if (submissionError?.code === "23505") {
			return {
				status: "pending",
				message: "This product is already waiting for review.",
				evidenceAccepted: false,
			};
		}
		throw submissionError ?? new Error("Product submission could not be saved.");
	}

	if (matchedDraft && !needsSourceComparisonReview && !hasSourceMatchedImageEvidence) {
		if (!verificationBundle) {
			throw new Error("Product verification could not be prepared.");
		}
		const source = usdaDraft ? "usda" : "open-food-facts";
		try {
			const sharedProductId = await publishSubmission({
				submissionId: submission.id,
				food: verificationBundle.canonicalFood,
				productName: matchedDraft.name,
				brandOwner: matchedDraft.brandOwner,
				source,
				sourceReference: matchedDraft.sourceReference,
				confidence: "source-verified",
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
			await admin.from("shared_product_submissions").delete().eq("id", submission.id);
			throw publishError;
		}
		return {
			status: "approved",
			message: "An exact source match verified this product, so it is now available to everyone.",
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
			"id, submitted_by, barcode, product_name, brand_owner, category_option_id, food, matched_source, matched_reference, validation_report, evidence_paths, evidence_complete, submission_kind, target_shared_product_id, base_revision_id, change_summary, label_observed_at, created_at",
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
		.select("id, barcode, product_name, brand_owner, category_option_id, food, status, evidence_complete, evidence_paths, validation_report")
		.eq("id", submissionId)
		.single();
	if (error || !submission) throw error ?? new Error("Submission not found.");
	if (submission.status !== "pending") {
		throw new Error("This product submission has already been reviewed.");
	}
	if (!submission.evidence_complete) {
		throw new Error("Complete label evidence is required before approval.");
	}

	const submittedFood = compactFood(submission.food as unknown as FdcFood);
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
	const food = applyCanonicalFoodCategory(submittedFood, category);
	food.customFood = false;
	food.dataType = "Shared Product";
	food.barcodeSource = "community";
	food.sharedProductConfidence = "moderator-reviewed";

	const verificationBundle = buildModeratorReviewedCatalogBundle(food);
	const sharedProductId = await publishSubmission({
		submissionId,
		food: verificationBundle.canonicalFood,
		productName: submission.product_name,
		brandOwner: submission.brand_owner ?? undefined,
		source: "community-reviewed",
		confidence: "moderator-reviewed",
		approvedBy: moderatorId,
		observations: verificationBundle.observations,
		provenance: verificationBundle.provenance,
		conflicts: verificationBundle.conflicts,
	});
	const evidencePaths = submission.evidence_paths as ProductEvidencePaths;
	const validationReport = submission.validation_report as ValidationReport;
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
		.select("id, submitted_by")
		.maybeSingle();
	if (error) throw error;
	if (!rejectedSubmission) {
		throw new Error("This product submission has already been reviewed.");
	}
	await createProductSubmissionBlockIfNeeded({
		userId: rejectedSubmission.submitted_by,
		moderatorId,
		sourceSubmissionId: rejectedSubmission.id,
	});
};
