import { getSupabaseAdminClient } from "$lib/supabase/admin.server";

export type ModeratorActionSummary = {
	pendingProductSubmissions: number | null;
	pendingFoodWarningReports: number | null;
	pendingProfileImageReviews: number | null;
	totalPendingReviews: number | null;
	unavailable: boolean;
	identityVerificationRequired: boolean;
};

const readCount = (
	result: { count: number | null; error: unknown },
) => {
	if (result.error) throw result.error;
	return result.count ?? 0;
};

export const readModeratorActionSummary = async (): Promise<ModeratorActionSummary> => {
	const admin = getSupabaseAdminClient();
	const [productSubmissions, foodWarningReports, profileImageReviews] =
		await Promise.all([
			admin
				.from("shared_product_submissions")
				.select("id", { count: "exact", head: true })
				.eq("status", "pending"),
			admin
				.from("food_compatibility_feedback")
				.select("id", { count: "exact", head: true })
				.eq("status", "pending"),
			admin
				.from("profiles")
				.select("user_id", { count: "exact", head: true })
				.not("avatar_path", "is", null)
				.eq("avatar_moderation_status", "self_attested"),
		]);

	const pendingProductSubmissions = readCount(productSubmissions);
	const pendingFoodWarningReports = readCount(foodWarningReports);
	const pendingProfileImageReviews = readCount(profileImageReviews);

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

export const getUnavailableModeratorActionSummary = (): ModeratorActionSummary => ({
	pendingProductSubmissions: null,
	pendingFoodWarningReports: null,
	pendingProfileImageReviews: null,
	totalPendingReviews: null,
	unavailable: true,
	identityVerificationRequired: false,
});

export const getIdentityVerificationRequiredModeratorActionSummary =
	(): ModeratorActionSummary => ({
		pendingProductSubmissions: null,
		pendingFoodWarningReports: null,
		pendingProfileImageReviews: null,
		totalPendingReviews: null,
		unavailable: false,
		identityVerificationRequired: true,
	});
