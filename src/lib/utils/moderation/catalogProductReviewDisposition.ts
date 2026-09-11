type JsonRecord = Record<string, unknown>;

export type CatalogProductReviewDispositionResult = {
	outcome: "accepted_withheld" | "accepted_evidence_gap";
	issueCount: number;
	reviewedAt: string;
};

export type CatalogProductReviewCategory = "publication" | "diagnostic";

export type CatalogProductReviewDispositionActionData = {
	catalogReviewDispositionCategory?: CatalogProductReviewCategory;
	catalogReviewDispositionError?: string;
	catalogReviewDispositionSuccess?: string;
	catalogReviewDispositionResult?: CatalogProductReviewDispositionResult;
};

const readRecord = (value: unknown): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError("Invalid catalog review disposition result.");
	}
	return value as JsonRecord;
};

export const parseCatalogProductReviewDispositionResult = (
	value: unknown,
): CatalogProductReviewDispositionResult => {
	const result = readRecord(value);
	if (
		result.outcome !== "accepted_withheld" &&
		result.outcome !== "accepted_evidence_gap"
	) {
		throw new TypeError("Invalid catalog review disposition outcome.");
	}
	if (
		!Number.isInteger(result.issueCount) ||
		(result.issueCount as number) < 1
	) {
		throw new TypeError("Invalid catalog review disposition issue count.");
	}
	if (typeof result.reviewedAt !== "string" || !result.reviewedAt) {
		throw new TypeError("Invalid catalog review disposition timestamp.");
	}
	return {
		outcome: result.outcome,
		issueCount: result.issueCount as number,
		reviewedAt: result.reviewedAt,
	};
};
