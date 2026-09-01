import type { FoodItem } from "$lib/utils/food/types";
import type { CatalogSubmissionIntent } from "$lib/utils/products/catalog";
import { productNamesAreUnrelated } from "$lib/utils/products/productIdentity";

export type CatalogIntakeIdentityRecord = {
	source: "canonical" | "usda" | "open-food-facts";
	sourceReference: string | null;
	productName: string;
	brandOwner: string | null;
};

export type CatalogIntakeIdentityCheck = CatalogIntakeIdentityRecord & {
	nameRelationship: "related" | "unrelated";
	brandRelationship: "related" | "unrelated" | "not-comparable";
	outcome: "match" | "review" | "mismatch";
};

export type CatalogIntakeIdentityValidation = {
	disposition: "accept" | "review" | "reject";
	checks: CatalogIntakeIdentityCheck[];
	blockingRecord: CatalogIntakeIdentityCheck | null;
	reviewFlags: string[];
};

const compareIdentityRecord = (
	submittedFood: FoodItem,
	record: CatalogIntakeIdentityRecord,
	minimumRelatedNameTokenOverlap: number,
): CatalogIntakeIdentityCheck => {
	const submittedBrand = submittedFood.brandOwner?.trim() ?? "";
	const recordBrand = record.brandOwner?.trim() ?? "";
	const nameRelationship = productNamesAreUnrelated(
		submittedFood.description,
		record.productName,
		minimumRelatedNameTokenOverlap,
	)
		? "unrelated"
		: "related";
	const brandRelationship =
		submittedBrand && recordBrand
			? productNamesAreUnrelated(
					submittedBrand,
					recordBrand,
					minimumRelatedNameTokenOverlap,
				)
				? "unrelated"
				: "related"
			: "not-comparable";

	return {
		...record,
		nameRelationship,
		brandRelationship,
		outcome:
			nameRelationship === "unrelated"
				? "mismatch"
				: brandRelationship === "unrelated"
					? "review"
					: "match",
	};
};

const createReviewFlags = (checks: CatalogIntakeIdentityCheck[]) => {
	const flaggedSources = checks
		.filter((check) => check.outcome !== "match")
		.map((check) => check.source);
	if (flaggedSources.length === 0) return [];

	return [
		`Submitted package identity requires evidence review against: ${flaggedSources.join(", ")}.`,
	];
};

export const validateCatalogIntakeIdentity = ({
	submittedFood,
	canonicalRecord,
	exactSourceRecords,
	intent,
	minimumRelatedNameTokenOverlap,
}: {
	submittedFood: FoodItem;
	canonicalRecord: CatalogIntakeIdentityRecord | null;
	exactSourceRecords: CatalogIntakeIdentityRecord[];
	intent: CatalogSubmissionIntent;
	minimumRelatedNameTokenOverlap: number;
}): CatalogIntakeIdentityValidation => {
	const canonicalCheck = canonicalRecord
		? compareIdentityRecord(
				submittedFood,
				canonicalRecord,
				minimumRelatedNameTokenOverlap,
			)
		: null;
	const sourceChecks = exactSourceRecords.map((record) =>
		compareIdentityRecord(
			submittedFood,
			record,
			minimumRelatedNameTokenOverlap,
		),
	);
	const checks = [...(canonicalCheck ? [canonicalCheck] : []), ...sourceChecks];
	const canonicalMismatch =
		canonicalCheck?.outcome === "mismatch" ? canonicalCheck : null;
	const allExactSourcesMismatch =
		!canonicalCheck &&
		sourceChecks.length > 0 &&
		sourceChecks.every((check) => check.outcome === "mismatch");
	const blockingRecord = canonicalMismatch
		? canonicalMismatch
		: allExactSourcesMismatch
			? sourceChecks[0]
			: null;

	if (blockingRecord && intent !== "catalog_correction") {
		return {
			disposition: "reject",
			checks,
			blockingRecord,
			reviewFlags: [],
		};
	}

	const needsReview =
		checks.length === 0 ||
		Boolean(blockingRecord) ||
		checks.some((check) => check.outcome !== "match");
	return {
		disposition: needsReview ? "review" : "accept",
		checks,
		blockingRecord: null,
		reviewFlags: createReviewFlags(checks),
	};
};
