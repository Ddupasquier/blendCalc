import {
	BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS,
	BLENDCALC_API_SCOPE_KEYS,
} from "$lib/blendCalcAPI/blendCalcAPIScopes";

export const BLENDCALC_API_V1_REQUIRED_PUBLIC_TERMS_REVIEWS = [
	"acceptable-use",
	"privacy",
	"source-and-asset-attribution",
	"correction-and-removal",
	"community-submission-rights",
	"health-and-nutrition-disclaimer",
	"warranty-and-liability",
] as const;

export const BLENDCALC_API_V1_ACCESS_POLICY = {
	accessMode: "internal-authenticated",
	publicAccessEnabled: false,
	publicReleaseStatus: "blocked-pending-professional-terms-review",
	professionalTermsReview: {
		status: "pending",
		reviewedAt: null,
		reviewReference: null,
	},
	requiredTermsReviews: BLENDCALC_API_V1_REQUIRED_PUBLIC_TERMS_REVIEWS,
	plannedKeyedAccess: {
		scopes: BLENDCALC_API_SCOPE_KEYS,
		operationScopeRequirements: BLENDCALC_API_OPERATION_SCOPE_REQUIREMENTS,
	},
} as const;
