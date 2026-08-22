import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import {
	listPendingProfileImageReports,
	reviewProfileImageReport,
} from "$lib/server/moderation/profileImageReports.server";

const createQuery = (result: unknown) => {
	const query = {
		select: vi.fn(),
		eq: vi.fn(),
		in: vi.fn(),
		order: vi.fn(),
		update: vi.fn(),
		maybeSingle: vi.fn().mockResolvedValue(result),
		then: (resolve: (value: unknown) => unknown) =>
			Promise.resolve(result).then(resolve),
	};
	query.select.mockReturnValue(query);
	query.eq.mockReturnValue(query);
	query.in.mockReturnValue(query);
	query.order.mockReturnValue(query);
	query.update.mockReturnValue(query);
	return query;
};

describe("profile image report moderation repository", () => {
	beforeEach(() => vi.clearAllMocks());

	it("groups reports about one exact current image into one review item", async () => {
		const reportRows = [
			{
				id: "report-1",
				reported_profile_user_id: "user-1",
				avatar_path: "user-1/avatar.webp",
				reason_code: "impersonation",
				details: "This image belongs to someone else.",
				created_at: "2026-08-20T10:00:00.000Z",
			},
			{
				id: "report-2",
				reported_profile_user_id: "user-1",
				avatar_path: "user-1/avatar.webp",
				reason_code: "other",
				details: null,
				created_at: "2026-08-21T10:00:00.000Z",
			},
		];
		const reportQuery = createQuery({ data: reportRows, error: null });
		const profileQuery = createQuery({
			data: [{
				user_id: "user-1",
				display_name: "Profile Owner",
				avatar_path: "user-1/avatar.webp",
				avatar_alt_text: "Profile owner smiling",
			}],
			error: null,
		});
		const createSignedUrls = vi.fn().mockResolvedValue({
			data: [{ path: "user-1/avatar.webp", signedUrl: "https://signed.test/avatar" }],
			error: null,
		});
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: string) =>
				table === "profile_image_reports" ? reportQuery : profileQuery),
			storage: { from: vi.fn(() => ({ createSignedUrls })) },
		});

		await expect(listPendingProfileImageReports()).resolves.toEqual([{
			id: "report-1",
			reportedProfileUserId: "user-1",
			displayName: "Profile Owner",
			avatarUrl: "https://signed.test/avatar",
			avatarAltText: "Profile owner smiling",
			createdAt: "2026-08-20T10:00:00.000Z",
			reports: [
				expect.objectContaining({ id: "report-1", reasonCode: "impersonation" }),
				expect.objectContaining({ id: "report-2", reasonCode: "other" }),
			],
		}]);
		expect(createSignedUrls).toHaveBeenCalledWith(["user-1/avatar.webp"], 600);
	});

	it("does not fail Profile while the additive report table is rolling out", async () => {
		const reportQuery = createQuery({
			data: null,
			error: {
				code: "PGRST205",
				message: "Could not find public.profile_image_reports in the schema cache",
			},
		});
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn(() => reportQuery),
		});

		await expect(listPendingProfileImageReports()).resolves.toEqual([]);
	});

	it("dismisses every pending report for the reviewed image without removing it", async () => {
		const reportLookup = createQuery({
			data: {
				id: "report-1",
				reported_profile_user_id: "user-1",
				avatar_path: "user-1/avatar.webp",
				status: "pending",
			},
			error: null,
		});
		const reportUpdate = createQuery({ data: null, error: null });
		const reportQueries = [reportLookup, reportUpdate];
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn(() => reportQueries.shift()),
		});

		await expect(reviewProfileImageReport({
			reportId: "report-1",
			reviewedBy: "moderator-1",
			decision: "dismissed",
			reviewNote: "The image follows the profile-image rules.",
		})).resolves.toBe("reviewed");
		expect(reportUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
			status: "dismissed",
			reviewed_by: "moderator-1",
			review_note: "The image follows the profile-image rules.",
		}));
		expect(reportUpdate.eq).toHaveBeenCalledWith("avatar_path", "user-1/avatar.webp");
	});

	it("removes only the exact current image before closing its reports", async () => {
		const reportLookup = createQuery({
			data: {
				id: "report-1",
				reported_profile_user_id: "user-1",
				avatar_path: "user-1/avatar.webp",
				status: "pending",
			},
			error: null,
		});
		const profileUpdate = createQuery({ data: { user_id: "user-1" }, error: null });
		const reportUpdate = createQuery({ data: null, error: null });
		const reportQueries = [reportLookup, reportUpdate];
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: string) =>
				table === "profiles" ? profileUpdate : reportQueries.shift()),
		});

		await expect(reviewProfileImageReport({
			reportId: "report-1",
			reviewedBy: "moderator-1",
			decision: "removed",
			reviewNote: "The image contains disallowed content.",
		})).resolves.toBe("reviewed");
		expect(profileUpdate.update).toHaveBeenCalledWith({
			avatar_path: null,
			avatar_alt_text: null,
			avatar_moderation_status: "rejected",
		});
		expect(profileUpdate.eq).toHaveBeenCalledWith("avatar_path", "user-1/avatar.webp");
		expect(reportUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
			status: "removed",
		}));
	});
});
