export type CatalogFieldVerificationMethod =
	| "exact-barcode"
	| "package-label"
	| "corroborated-sources"
	| "moderator-reviewed";

export type CatalogFieldReviewState = "accepted" | "moderator-reviewed";

export const getCatalogFieldVerificationMethod = (
	verificationMethod: string,
	confidence: string,
): CatalogFieldVerificationMethod | null => {
	if (confidence === "moderator-reviewed") return "moderator-reviewed";

	switch (verificationMethod) {
		case "exact-barcode":
			return "exact-barcode";
		case "label-review":
			return "package-label";
		case "cross-source":
			return "corroborated-sources";
		default:
			return null;
	}
};

export const getCatalogFieldReviewState = (
	confidence: string,
): CatalogFieldReviewState =>
	confidence === "moderator-reviewed"
		? "moderator-reviewed"
		: "accepted";
