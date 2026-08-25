import type { FoodItem } from "$lib/utils/food/types";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import {
	compareCatalogSubmissionToExistingProduct,
	type CatalogSubmissionComparison,
} from "$lib/utils/products/catalogSubmissionComparison";
import {
	createCatalogUpdateSourceCheck,
	createCatalogUpdateSummary,
	type CatalogUpdateSummary,
} from "$lib/utils/products/catalogUpdateReview";
import {
	buildCombinedSourceCatalogBundle,
	type CatalogVerificationBundle,
} from "./catalogVerification.server";
import { createCatalogFoodFromDraft } from "./catalogFood.server";
import type { CatalogUpdateTarget } from "./catalogUpdateReview.server";
import {
	applyCanonicalFoodCategory,
	type ResolvedFoodCategory,
} from "./categoryMapping.server";
import type { CatalogSourceAssessment } from "./catalogSourceAssessment.server";
import type { ProductEvidencePaths } from "./productEvidence.server";
import { hasCompleteProductEvidence } from "./productEvidence.server";
import type { FoodImagePlacementValues } from "./foodImages.server";

export type CatalogSubmissionValidationReport = {
	valid: boolean;
	issues: string[];
	usdaMatch?: boolean;
	openFoodFactsMatch?: boolean;
	externalLookupFailed?: boolean;
	evidenceComplete?: boolean;
	conflictCount?: number;
	existingCatalogMatch?: boolean;
	existingCatalogAction?: "already_available" | "update_review";
	existingCatalogComparison?: CatalogSubmissionComparison;
	imageCrop?: FoodImagePlacementValues | null;
};

const sanitizeReviewFlags = (reviewFlags: string[] = []) =>
	Array.from(
		new Set(
			reviewFlags
				.map((flag) => flag.trim())
				.filter(Boolean)
				.map((flag) => flag.slice(0, 1000)),
		),
	).slice(0, 10);

export const buildProductSubmissionReviewFlags = ({
	requestedFlags = [],
	existingComparison,
	sourceComparison,
}: {
	requestedFlags?: string[];
	existingComparison?: CatalogSubmissionComparison | null;
	sourceComparison?: CatalogSubmissionComparison | null;
}) =>
	sanitizeReviewFlags([
		...requestedFlags,
		...(existingComparison
			? [
					"Barcode exists in the active shared catalog, but the submitted label data differs. Review as a catalog update request.",
					...existingComparison.issues,
				]
			: []),
		...(sourceComparison?.issues ?? []),
	]);

export type PreparedCatalogSubmissionReview = {
	canonicalCategory: ResolvedFoodCategory;
	canonicalSubmissionFood: FoodItem;
	catalogUpdateSummary: CatalogUpdateSummary | null;
	evidenceComplete: boolean;
	hasSourceMatchedImageEvidence: boolean;
	matchedDraft: CatalogSourceAssessment["mergedDraft"];
	needsSourceComparisonReview: boolean;
	report: CatalogSubmissionValidationReport;
	sourceMismatchName?: string;
	verificationBundle: CatalogVerificationBundle | null;
};

export const resolveCatalogSubmissionIntent = ({
	requestedIntent,
	existingComparison,
}: {
	requestedIntent: CatalogSubmissionIntent;
	existingComparison: CatalogSubmissionComparison | null;
}): CatalogSubmissionIntent =>
	existingComparison?.matchesExisting === false
		? "catalog_correction"
		: requestedIntent;

export const prepareCatalogSubmissionReview = (input: {
	submissionFood: FoodItem;
	selectedCategory: ResolvedFoodCategory;
	existingCatalogFood: FoodItem | null;
	existingComparison: CatalogSubmissionComparison | null;
	updateTarget: CatalogUpdateTarget | null;
	sourceAssessment: CatalogSourceAssessment;
	evidencePaths: ProductEvidencePaths;
	requestedReviewFlags?: string[];
	frontImageCrop?: FoodImagePlacementValues | null;
	labelObservedAt: string;
}): PreparedCatalogSubmissionReview => {
	const {
		resolutionPolicy,
		usdaDraft,
		openFoodFactsDraft,
		mergedDraft: matchedDraft,
	} = input.sourceAssessment;
	const canonicalCategory = input.existingComparison
		? input.selectedCategory
		: (matchedDraft?.categoryResolution ?? input.selectedCategory);
	const canonicalSubmissionFood = applyCanonicalFoodCategory(
		input.submissionFood,
		canonicalCategory,
	);
	const sourceComparison = matchedDraft
		? compareCatalogSubmissionToExistingProduct(
				canonicalSubmissionFood,
				createCatalogFoodFromDraft(matchedDraft, canonicalCategory),
				resolutionPolicy,
			)
		: null;
	const sourceMismatchName =
		!input.existingComparison && sourceComparison?.hasBlockingIdentityMismatch
			? matchedDraft?.name
			: undefined;
	const reviewFlags = buildProductSubmissionReviewFlags({
		requestedFlags: input.requestedReviewFlags,
		existingComparison: input.existingComparison,
		sourceComparison,
	});
	const needsSourceComparisonReview = reviewFlags.length > 0;
	const catalogUpdateSummary =
		input.existingComparison && input.existingCatalogFood && input.updateTarget
			? createCatalogUpdateSummary({
					comparison: input.existingComparison,
					baseRevisionNumber: input.updateTarget.baseRevisionNumber,
					observedAt: input.labelObservedAt,
					sourceChecks: [
						createCatalogUpdateSourceCheck({
							source: "usda",
							status: input.sourceAssessment.usdaLookupStatus,
							checkedAt: input.labelObservedAt,
							sourceReference: usdaDraft?.sourceReference,
							sourceFood: usdaDraft
								? createCatalogFoodFromDraft(
										usdaDraft,
										usdaDraft.categoryResolution ?? input.selectedCategory,
									)
								: null,
							submittedFood: canonicalSubmissionFood,
							currentFood: input.existingCatalogFood,
							resolutionPolicy,
						}),
						createCatalogUpdateSourceCheck({
							source: "open-food-facts",
							status: input.sourceAssessment.openFoodFactsLookupStatus,
							checkedAt: input.labelObservedAt,
							sourceReference: openFoodFactsDraft?.sourceReference,
							sourceFood: openFoodFactsDraft
								? createCatalogFoodFromDraft(
										openFoodFactsDraft,
										openFoodFactsDraft.categoryResolution ??
											input.selectedCategory,
									)
								: null,
							submittedFood: canonicalSubmissionFood,
							currentFood: input.existingCatalogFood,
							resolutionPolicy,
						}),
					],
				})
			: null;
	const hasSourceMatchedImageEvidence = Boolean(
		matchedDraft &&
		!needsSourceComparisonReview &&
		!canonicalSubmissionFood.image?.imageUrl &&
		input.evidencePaths.front,
	);
	const evidenceComplete = hasSourceMatchedImageEvidence
		? true
		: canonicalSubmissionFood.image?.imageUrl
			? Boolean(input.evidencePaths.nutrition && input.evidencePaths.barcode)
			: hasCompleteProductEvidence(input.evidencePaths);
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
	const sourceDrafts = [usdaDraft, openFoodFactsDraft].filter(
		(draft): draft is NonNullable<typeof draft> => Boolean(draft),
	);
	const verificationBundle = matchedDraft
		? buildCombinedSourceCatalogBundle(
				canonicalSubmissionFood,
				matchedDraft,
				sourceDrafts,
				canonicalCategory,
				resolutionPolicy,
			)
		: null;
	const report: CatalogSubmissionValidationReport = {
		valid: true,
		issues: reviewFlags,
		usdaMatch: Boolean(usdaDraft),
		openFoodFactsMatch: Boolean(openFoodFactsDraft),
		externalLookupFailed: input.sourceAssessment.externalLookupFailed,
		evidenceComplete,
		conflictCount: verificationBundle?.conflicts.length ?? 0,
		existingCatalogMatch: Boolean(input.existingComparison),
		existingCatalogAction: input.existingComparison
			? "update_review"
			: undefined,
		existingCatalogComparison: input.existingComparison ?? undefined,
		imageCrop: input.frontImageCrop ?? null,
	};

	return {
		canonicalCategory,
		canonicalSubmissionFood,
		catalogUpdateSummary,
		evidenceComplete,
		hasSourceMatchedImageEvidence,
		matchedDraft,
		needsSourceComparisonReview,
		report,
		sourceMismatchName,
		verificationBundle,
	};
};
