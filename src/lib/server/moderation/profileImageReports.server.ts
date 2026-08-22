import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import { PROFILE_AVATAR_BUCKET } from "$lib/utils/profile/profile";
import { getDefaultDisplayName } from "$lib/utils/profile/profileValidation";

export const PROFILE_IMAGE_REPORT_REASON_CODES = [
	"explicit_content",
	"graphic_violence",
	"hate_or_harassment",
	"impersonation",
	"other",
] as const;

export type ProfileImageReportReasonCode =
	(typeof PROFILE_IMAGE_REPORT_REASON_CODES)[number];
export type ProfileImageReportDecision = "dismissed" | "removed";

type DatabaseError = {
	code?: string | null;
	message?: string | null;
};

const isMissingProfileImageReportsTable = (error: DatabaseError | null) =>
	Boolean(
		error &&
			(error.code === "42P01" || error.code === "PGRST205") &&
			error.message?.includes("profile_image_reports"),
	);

export const listPendingProfileImageReports = async () => {
	const admin = getSupabaseAdminClient();
	const { data: reports, error } = await admin
		.from("profile_image_reports")
		.select(
			"id, reported_profile_user_id, avatar_path, reason_code, details, created_at",
		)
		.eq("status", "pending")
		.order("created_at", { ascending: true });

	if (isMissingProfileImageReportsTable(error)) return [];
	if (error) throw error;
	if (!reports?.length) return [];

	const profileUserIds = [
		...new Set(reports.map((report) => report.reported_profile_user_id)),
	];
	const { data: profiles, error: profilesError } = await admin
		.from("profiles")
		.select("user_id, display_name, avatar_path, avatar_alt_text")
		.in("user_id", profileUserIds);

	if (profilesError) throw profilesError;

	const profileByUserId = new Map(
		(profiles ?? []).map((profile) => [profile.user_id, profile]),
	);
	const avatarPaths = [...new Set(reports.map((report) => report.avatar_path))];
	const { data: signedAvatars, error: signedAvatarError } = await admin.storage
		.from(PROFILE_AVATAR_BUCKET)
		.createSignedUrls(avatarPaths, 10 * 60);

	if (signedAvatarError) throw signedAvatarError;

	const signedAvatarByPath = new Map(
		(signedAvatars ?? [])
			.filter((avatar) => avatar.path && avatar.signedUrl)
			.map((avatar) => [avatar.path, avatar.signedUrl]),
	);

	const reportsByImage = new Map<string, typeof reports>();
	for (const report of reports) {
		const key = `${report.reported_profile_user_id}:${report.avatar_path}`;
		const existing = reportsByImage.get(key) ?? [];
		existing.push(report);
		reportsByImage.set(key, existing);
	}

	return [...reportsByImage.values()].flatMap((imageReports) => {
		const firstReport = imageReports[0];
		if (!firstReport) return [];
		const profile = profileByUserId.get(firstReport.reported_profile_user_id);
		if (!profile || profile.avatar_path !== firstReport.avatar_path) return [];

		return [{
			id: firstReport.id,
			reportedProfileUserId: firstReport.reported_profile_user_id,
			displayName:
				profile.display_name ||
				getDefaultDisplayName(firstReport.reported_profile_user_id),
			avatarUrl: signedAvatarByPath.get(firstReport.avatar_path) ?? null,
			avatarAltText: profile.avatar_alt_text,
			createdAt: firstReport.created_at,
			reports: imageReports.map((report) => ({
				id: report.id,
				reasonCode: report.reason_code as ProfileImageReportReasonCode,
				details: report.details,
				createdAt: report.created_at,
			})),
		}];
	});
};

export const reviewProfileImageReport = async ({
	reportId,
	reviewedBy,
	decision,
	reviewNote,
}: {
	reportId: string;
	reviewedBy: string;
	decision: ProfileImageReportDecision;
	reviewNote: string;
}) => {
	const admin = getSupabaseAdminClient();
	const { data: report, error } = await admin
		.from("profile_image_reports")
		.select("id, reported_profile_user_id, avatar_path, status")
		.eq("id", reportId)
		.maybeSingle();

	if (isMissingProfileImageReportsTable(error)) return "reports-unavailable" as const;
	if (error) throw error;
	if (!report || report.status !== "pending") return "already-reviewed" as const;

	if (decision === "removed") {
		const { data: removedProfile, error: removeError } = await admin
			.from("profiles")
			.update({
				avatar_path: null,
				avatar_alt_text: null,
				avatar_moderation_status: "rejected",
			})
			.eq("user_id", report.reported_profile_user_id)
			.eq("avatar_path", report.avatar_path)
			.select("user_id")
			.maybeSingle();

		if (removeError) throw removeError;
		if (!removedProfile) {
			const { data: currentProfile, error: currentProfileError } = await admin
				.from("profiles")
				.select("avatar_path, avatar_moderation_status")
				.eq("user_id", report.reported_profile_user_id)
				.maybeSingle();

			if (currentProfileError) throw currentProfileError;
			const removalAlreadyCompleted =
				currentProfile?.avatar_path === null &&
				currentProfile.avatar_moderation_status === "rejected";
			if (!removalAlreadyCompleted) {
				await admin
					.from("profile_image_reports")
					.update({ status: "superseded" })
					.eq("id", report.id)
					.eq("status", "pending");
				return "image-changed" as const;
			}
		}
	}

	const reviewedAt = new Date().toISOString();
	const { error: reviewError } = await admin
		.from("profile_image_reports")
		.update({
			status: decision,
			reviewed_by: reviewedBy,
			reviewed_at: reviewedAt,
			review_note: reviewNote,
		})
		.eq("reported_profile_user_id", report.reported_profile_user_id)
		.eq("avatar_path", report.avatar_path)
		.eq("status", "pending");

	if (reviewError) throw reviewError;
	return "reviewed" as const;
};
