import type { AppPermission, AppRole } from "./moderation";

export type PrivilegedReviewSummary = {
	pendingProductSubmissions: number | null;
	pendingFoodWarningReports: number | null;
	pendingProfileImageReviews: number | null;
	totalPendingReviews: number | null;
	unavailable: boolean;
	identityVerificationRequired: boolean;
};

export type ProfilePrivilegedToolAccess = {
	role: AppRole;
	permissions: AppPermission[];
	reviewSummary: PrivilegedReviewSummary;
};

export const PROFILE_PRIVILEGED_TOOL_PERMISSIONS = {
	accountManagement: "moderation.accounts.manage",
	catalogReview: "moderation.catalog.review",
	dataOperationsRead: "data_operations.catalog_health.read",
	warningReview: "moderation.warnings.review",
} as const satisfies Record<string, AppPermission>;

export const hasAppPermission = (
	permissions: readonly AppPermission[],
	permission: AppPermission,
) => permissions.includes(permission);

export const getProfilePrivilegedToolTitle = (role: AppRole) => {
	switch (role) {
		case "admin":
			return "Admin tools";
		case "developer":
			return "Developer tools";
		default:
			return "Moderator tools";
	}
};

export const getAvailableProfilePrivilegedToolCount = (
	permissions: readonly AppPermission[],
) =>
	Number(hasAppPermission(permissions, PROFILE_PRIVILEGED_TOOL_PERMISSIONS.catalogReview)) * 2 +
	Number(hasAppPermission(permissions, PROFILE_PRIVILEGED_TOOL_PERMISSIONS.warningReview)) +
	Number(hasAppPermission(permissions, PROFILE_PRIVILEGED_TOOL_PERMISSIONS.accountManagement)) * 2 +
	Number(hasAppPermission(permissions, PROFILE_PRIVILEGED_TOOL_PERMISSIONS.dataOperationsRead));
