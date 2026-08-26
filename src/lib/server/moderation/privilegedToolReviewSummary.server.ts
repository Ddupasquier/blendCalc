import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import type { AppPermission } from "$lib/utils/moderation/moderation";
import {
	hasAppPermission,
	PROFILE_PRIVILEGED_TOOL_PERMISSIONS,
	type PrivilegedReviewSummary,
} from "$lib/utils/moderation/profilePrivilegedTools";

const readCount = (result: { count: number | null; error: unknown }) => {
	if (result.error) throw result.error;
	return result.count ?? 0;
};

type DatabaseError = {
	code?: string | null;
	message?: string | null;
};

const readPendingProfileImageReviewCount = (result: {
	data: number | null;
	error: DatabaseError | null;
}) => {
	if (
		result.error &&
		(result.error.code === "42883" || result.error.code === "PGRST202") &&
		result.error.message?.includes("get_pending_profile_image_review_count")
	) {
		return 0;
	}
	if (result.error) throw result.error;
	return result.data ?? 0;
};

export const readPrivilegedToolReviewSummary = async (
	permissions: readonly AppPermission[],
): Promise<PrivilegedReviewSummary> => {
	const admin = getSupabaseAdminClient();
	const canReviewProducts = hasAppPermission(
		permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.catalogReview,
	);
	const canReviewWarnings = hasAppPermission(
		permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.warningReview,
	);
	const canManageAccounts = hasAppPermission(
		permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.accountManagement,
	);
	const [productSubmissions, foodWarningReports, profileImageReviews] =
		await Promise.all([
			canReviewProducts
				? admin
						.from("shared_product_submissions")
						.select("id", { count: "exact", head: true })
						.eq("status", "pending")
				: Promise.resolve({ count: 0, error: null }),
			canReviewWarnings
				? admin
						.from("food_compatibility_feedback")
						.select("id", { count: "exact", head: true })
						.eq("status", "pending")
				: Promise.resolve({ count: 0, error: null }),
			canManageAccounts
				? admin.rpc("get_pending_profile_image_review_count")
				: Promise.resolve({ data: 0, error: null }),
		]);

	const pendingProductSubmissions = readCount(productSubmissions);
	const pendingFoodWarningReports = readCount(foodWarningReports);
	const pendingProfileImageReviews =
		readPendingProfileImageReviewCount(profileImageReviews);

	return {
		pendingProductSubmissions,
		pendingFoodWarningReports,
		pendingProfileImageReviews,
		totalPendingReviews:
			pendingProductSubmissions +
			pendingFoodWarningReports +
			pendingProfileImageReviews,
		unavailable: false,
		identityVerificationRequired: false,
	};
};

export const getUnavailablePrivilegedToolReviewSummary =
	(): PrivilegedReviewSummary => ({
		pendingProductSubmissions: null,
		pendingFoodWarningReports: null,
		pendingProfileImageReviews: null,
		totalPendingReviews: null,
		unavailable: true,
		identityVerificationRequired: false,
	});

export const getIdentityVerificationRequiredPrivilegedToolReviewSummary =
	(): PrivilegedReviewSummary => ({
		pendingProductSubmissions: null,
		pendingFoodWarningReports: null,
		pendingProfileImageReviews: null,
		totalPendingReviews: null,
		unavailable: false,
		identityVerificationRequired: true,
	});
