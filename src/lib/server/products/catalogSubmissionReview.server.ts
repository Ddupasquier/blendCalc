import type { FoodItem } from "$lib/utils/food/types";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import type { CatalogIntakeIdentityValidation } from "$lib/utils/products/catalogIntakeIdentity";
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
import {
	describeProductEvidencePhotos,
	getMissingProductEvidenceRoles,
	getTrustedSourceEvidencePolicy,
} from "$lib/utils/products/productEvidenceRequirements";
import type { FoodImagePlacementValues } from "./foodImages.server";
import type { ProductSourceFieldMetricIncrement } from "./sourceMetrics.server";
import { findSubmittedLabelDisagreementMetrics } from "./catalogSourceAccuracy.server";
import type { CatalogSourceAccuracyConflict } from "./catalogSourceAccuracy.server";

export type CatalogSubmissionValidationReport = {
	valid: boolean;
	trustDisposition?:
		| "source-aligned"
		| "unverified"
		| "conflicts-with-trusted-evidence"
		| "trusted-evidence-check-incomplete";
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
	sourceLabelDisagreementMetrics?: ProductSourceFieldMetricIncrement[];
	sourceAccuracyConflicts?: CatalogSourceAccuracyConflict[];
	retainedEvidenceConflictCount?: number;
	retainedEvidenceLookupFailed?: boolean;
	sourceAutoPublishEligible?: boolean;
};

export const resolveCatalogSubmissionTrust = (input: {
	hasTrustedEvidenceConflict: boolean;
	retainedEvidenceLookupFailed: boolean;
	hasSourceMatch: boolean;
}) => ({
	valid:
		!input.hasTrustedEvidenceConflict && !input.retainedEvidenceLookupFailed,
	trustDisposition: input.retainedEvidenceLookupFailed
		? ("trusted-evidence-check-incomplete" as const)
		: input.hasTrustedEvidenceConflict
			? ("conflicts-with-trusted-evidence" as const)
			: input.hasSourceMatch
				? ("source-aligned" as const)
				: ("unverified" as const),
});

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
	sourceAccuracyFlags = [],
	retainedEvidenceComparisons = [],
	retainedEvidenceLookupFailed = false,
}: {
	requestedFlags?: string[];
	existingComparison?: CatalogSubmissionComparison | null;
	sourceComparison?: CatalogSubmissionComparison | null;
	sourceAccuracyFlags?: string[];
	retainedEvidenceComparisons?: Array<{
		source: string;
		sourceReference: string;
		comparison: CatalogSubmissionComparison;
	}>;
	retainedEvidenceLookupFailed?: boolean;
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
		...retainedEvidenceComparisons.flatMap(
			({ source, sourceReference, comparison }) => [
				`Stored exact-barcode evidence from ${source} (${sourceReference}) conflicts with the submitted package data.`,
				...comparison.changes
					.filter((change) => change.severity !== "low")
					.map((change) => change.message),
			],
		),
		...sourceAccuracyFlags,
		...(retainedEvidenceLookupFailed
			? [
					"Stored exact-barcode evidence could not be checked. Automatic publication is blocked until review.",
				]
			: []),
	]);

export type PreparedCatalogSubmissionReview = {
	canonicalCategory: ResolvedFoodCategory;
	canonicalSubmissionFood: FoodItem;
	catalogUpdateSummary: CatalogUpdateSummary | null;
	evidenceComplete: boolean;
	hasSourceMatchedImageEvidence: boolean;
	matchedDraft: CatalogSourceAssessment["mergedDraft"];
	needsSourceComparisonReview: boolean;
	sourceCanAutoPublish: boolean;
	report: CatalogSubmissionValidationReport;
	verificationBundle: CatalogVerificationBundle | null;
};

export const evaluateCatalogSubmissionEvidence = (input: {
	hasSourceMatch: boolean;
	sourceCanAutoPublish: boolean;
	needsSourceComparisonReview: boolean;
	hasCanonicalImage: boolean;
	evidencePaths: ProductEvidencePaths;
}) => {
	const requiresSourceEvidenceReview =
		input.hasSourceMatch && !input.sourceCanAutoPublish;
	const hasSourceMatchedImageEvidence = Boolean(
		input.hasSourceMatch &&
		input.sourceCanAutoPublish &&
		!input.needsSourceComparisonReview &&
		!input.hasCanonicalImage &&
		input.evidencePaths.front,
	);
	const sourceEvidencePolicy = getTrustedSourceEvidencePolicy({
		hasExactSourceMatch: input.hasSourceMatch,
		hasSourceChanges: input.needsSourceComparisonReview,
	});
	const evidenceComplete = !sourceEvidencePolicy.requiresCatalogEvidence
		? true
		: hasSourceMatchedImageEvidence
			? true
			: input.hasCanonicalImage
				? Boolean(input.evidencePaths.nutrition && input.evidencePaths.barcode)
				: hasCompleteProductEvidence(input.evidencePaths);

	return {
		evidenceComplete,
		hasSourceMatchedImageEvidence,
		requiresSourceEvidenceReview,
	};
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
	identityValidation: CatalogIntakeIdentityValidation;
	evidencePaths: ProductEvidencePaths;
	requestedReviewFlags?: string[];
	frontImageCrop?: FoodImagePlacementValues | null;
	labelObservedAt: string;
	sourceCanAutoPublish: boolean;
}): PreparedCatalogSubmissionReview => {
	if (input.identityValidation.disposition === "reject") {
		throw new Error(
			"Catalog field proposals require a non-rejected identity validation.",
		);
	}
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
	const retainedEvidenceComparisons = input.existingCatalogFood
		? []
		: input.sourceAssessment.retainedExactObservations.flatMap(
				(observation) => {
					const comparison = compareCatalogSubmissionToExistingProduct(
						canonicalSubmissionFood,
						observation.food,
						resolutionPolicy,
					);
					return comparison.changes.some((change) => change.severity !== "low")
						? [
								{
									source: observation.source,
									sourceReference: observation.sourceReference,
									comparison,
								},
							]
						: [];
				},
			);
	const reviewFlags = buildProductSubmissionReviewFlags({
		requestedFlags: [
			...(input.requestedReviewFlags ?? []),
			...input.identityValidation.reviewFlags,
		],
		existingComparison: input.existingComparison,
		sourceComparison,
		sourceAccuracyFlags: input.sourceAssessment.sourceAccuracy.reviewFlags,
		retainedEvidenceComparisons,
		retainedEvidenceLookupFailed:
			input.sourceAssessment.retainedEvidenceLookupFailed,
	});
	const needsSourceComparisonReview = reviewFlags.length > 0;
	const hasTrustedEvidenceConflict = Boolean(
		input.existingComparison?.changes.some(
			(change) => change.severity !== "low",
		) ||
		sourceComparison?.changes.some((change) => change.severity !== "low") ||
		retainedEvidenceComparisons.length > 0 ||
		input.sourceAssessment.sourceAccuracy.conflicts.some(
			(conflict) => conflict.severity !== "low",
		),
	);
	const sourceCanAutoPublish =
		input.sourceCanAutoPublish &&
		!input.sourceAssessment.retainedEvidenceLookupFailed;
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
	const { evidenceComplete, hasSourceMatchedImageEvidence } =
		evaluateCatalogSubmissionEvidence({
			hasSourceMatch: Boolean(matchedDraft),
			sourceCanAutoPublish,
			needsSourceComparisonReview,
			hasCanonicalImage: Boolean(canonicalSubmissionFood.image?.imageUrl),
			evidencePaths: input.evidencePaths,
		});
	const missingEvidenceDescription = describeProductEvidencePhotos(
		getMissingProductEvidenceRoles(input.evidencePaths),
	);
	if (!matchedDraft && !evidenceComplete) {
		throw new Error(
			`Unknown products need ${missingEvidenceDescription} for verification.`,
		);
	}
	if (needsSourceComparisonReview && !evidenceComplete) {
		throw new Error(
			`Source comparison reviews need ${missingEvidenceDescription} for verification.`,
		);
	}
	const sourceLabelDisagreementMetrics = hasCompleteProductEvidence(
		input.evidencePaths,
	)
		? [usdaDraft, openFoodFactsDraft].flatMap((sourceDraft) =>
				sourceDraft
					? findSubmittedLabelDisagreementMetrics(
							canonicalSubmissionFood,
							sourceDraft,
							resolutionPolicy,
						)
					: [],
			)
		: [];
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
				input.sourceAssessment.sourceAccuracy.conflicts,
			)
		: null;
	const trust = resolveCatalogSubmissionTrust({
		hasTrustedEvidenceConflict,
		retainedEvidenceLookupFailed:
			input.sourceAssessment.retainedEvidenceLookupFailed,
		hasSourceMatch: Boolean(matchedDraft),
	});
	const retainedEvidenceConflictCount = retainedEvidenceComparisons.reduce(
		(total, { comparison }) =>
			total +
			comparison.changes.filter((change) => change.severity !== "low").length,
		0,
	);
	const report: CatalogSubmissionValidationReport = {
		...trust,
		issues: reviewFlags,
		usdaMatch: Boolean(usdaDraft),
		openFoodFactsMatch: Boolean(openFoodFactsDraft),
		externalLookupFailed: input.sourceAssessment.externalLookupFailed,
		evidenceComplete,
		conflictCount:
			(verificationBundle?.conflicts.length ?? 0) +
			retainedEvidenceConflictCount,
		sourceAutoPublishEligible: sourceCanAutoPublish,
		existingCatalogMatch: Boolean(input.existingComparison),
		existingCatalogAction: input.existingComparison
			? "update_review"
			: undefined,
		existingCatalogComparison: input.existingComparison ?? undefined,
		imageCrop: input.frontImageCrop ?? null,
		sourceLabelDisagreementMetrics,
		sourceAccuracyConflicts: input.sourceAssessment.sourceAccuracy.conflicts,
		retainedEvidenceConflictCount,
		retainedEvidenceLookupFailed:
			input.sourceAssessment.retainedEvidenceLookupFailed,
	};

	return {
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
	};
};
