import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import {
	getIdentityVerificationRequiredPrivilegedToolReviewSummary,
	getUnavailablePrivilegedToolReviewSummary,
	readPrivilegedToolReviewSummary,
} from "$lib/server/moderation/privilegedToolReviewSummary.server";

const createCountQuery = (count: number | null, error: unknown = null) => {
	const query = {
		select: vi.fn(),
		not: vi.fn(),
		eq: vi.fn(),
	};
	query.select.mockReturnValue(query);
	query.not.mockReturnValue(query);
	query.eq.mockResolvedValue({ count, error });
	return query;
};

describe("Profile privileged tool review summary", () => {
	beforeEach(() => vi.clearAllMocks());
	const reviewPermissions = [
		"moderation.accounts.manage",
		"moderation.catalog.review",
		"moderation.warnings.review",
	] as const;

	it("counts pending queues and groups duplicate reports about one exact image", async () => {
		const queries = {
			shared_product_submissions: createCountQuery(3),
			food_compatibility_feedback: createCountQuery(2),
		};
		const from = vi.fn((table: keyof typeof queries) => queries[table]);
		const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
		mocks.getSupabaseAdminClient.mockReturnValue({ from, rpc });

		await expect(
			readPrivilegedToolReviewSummary(reviewPermissions),
		).resolves.toEqual({
			pendingProductSubmissions: 3,
			pendingFoodWarningReports: 2,
			pendingProfileImageReviews: 1,
			totalPendingReviews: 6,
			unavailable: false,
			identityVerificationRequired: false,
		});
		expect(from).toHaveBeenCalledTimes(2);
		for (const query of Object.values(queries)) {
			expect(query.select).toHaveBeenCalledWith(expect.any(String), {
				count: "exact",
				head: true,
			});
		}
		expect(rpc).toHaveBeenCalledWith("get_pending_profile_image_review_count");
	});

	it("rejects an incomplete privileged count read", async () => {
		const queries = {
			shared_product_submissions: createCountQuery(0),
			food_compatibility_feedback: createCountQuery(null, { code: "42501" }),
		};
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: keyof typeof queries) => queries[table]),
			rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
		});

		await expect(
			readPrivilegedToolReviewSummary(reviewPermissions),
		).rejects.toEqual({ code: "42501" });
	});

	it("keeps Profile usable while the additive report table is rolling out", async () => {
		const queries = {
			shared_product_submissions: createCountQuery(1),
			food_compatibility_feedback: createCountQuery(1),
		};
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: keyof typeof queries) => queries[table]),
			rpc: vi.fn().mockResolvedValue({
				data: null,
				error: {
					code: "PGRST202",
					message:
						"Could not find public.get_pending_profile_image_review_count in the schema cache",
				},
			}),
		});

		await expect(
			readPrivilegedToolReviewSummary(reviewPermissions),
		).resolves.toMatchObject({
			pendingProfileImageReviews: 0,
			totalPendingReviews: 2,
			unavailable: false,
		});
	});

	it("does not read review queues that the role cannot access", async () => {
		const from = vi.fn();
		const rpc = vi.fn();
		mocks.getSupabaseAdminClient.mockReturnValue({ from, rpc });

		await expect(readPrivilegedToolReviewSummary([])).resolves.toMatchObject({
			pendingProductSubmissions: 0,
			pendingFoodWarningReports: 0,
			pendingProfileImageReviews: 0,
			totalPendingReviews: 0,
		});
		expect(from).not.toHaveBeenCalled();
		expect(rpc).not.toHaveBeenCalled();
	});

	it("represents unavailable counts without pretending they are zero", () => {
		expect(getUnavailablePrivilegedToolReviewSummary()).toEqual({
			pendingProductSubmissions: null,
			pendingFoodWarningReports: null,
			pendingProfileImageReviews: null,
			totalPendingReviews: null,
			unavailable: true,
			identityVerificationRequired: false,
		});
	});

	it("withholds privileged review counts until identity verification", () => {
		expect(
			getIdentityVerificationRequiredPrivilegedToolReviewSummary(),
		).toEqual({
			pendingProductSubmissions: null,
			pendingFoodWarningReports: null,
			pendingProfileImageReviews: null,
			totalPendingReviews: null,
			unavailable: false,
			identityVerificationRequired: true,
		});
	});
});
