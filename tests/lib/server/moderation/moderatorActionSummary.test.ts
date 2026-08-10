import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import {
	getUnavailableModeratorActionSummary,
	readModeratorActionSummary,
} from "$lib/server/moderation/moderatorActionSummary.server";

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

describe("Profile moderator action summary", () => {
	beforeEach(() => vi.clearAllMocks());

	it("counts each pending review queue without loading queue rows", async () => {
		const queries = {
			shared_product_submissions: createCountQuery(3),
			food_compatibility_feedback: createCountQuery(2),
			profiles: createCountQuery(1),
		};
		const from = vi.fn((table: keyof typeof queries) => queries[table]);
		mocks.getSupabaseAdminClient.mockReturnValue({ from });

		await expect(readModeratorActionSummary()).resolves.toEqual({
			pendingProductSubmissions: 3,
			pendingFoodWarningReports: 2,
			pendingProfileImageReviews: 1,
			totalPendingReviews: 6,
			unavailable: false,
		});
		expect(from).toHaveBeenCalledTimes(3);
		for (const query of Object.values(queries)) {
			expect(query.select).toHaveBeenCalledWith(
				expect.any(String),
				{ count: "exact", head: true },
			);
		}
		expect(queries.profiles.not).toHaveBeenCalledWith(
			"avatar_path",
			"is",
			null,
		);
	});

	it("rejects an incomplete privileged count read", async () => {
		const queries = {
			shared_product_submissions: createCountQuery(0),
			food_compatibility_feedback: createCountQuery(null, { code: "42501" }),
			profiles: createCountQuery(0),
		};
		mocks.getSupabaseAdminClient.mockReturnValue({
			from: vi.fn((table: keyof typeof queries) => queries[table]),
		});

		await expect(readModeratorActionSummary()).rejects.toEqual({ code: "42501" });
	});

	it("represents unavailable counts without pretending they are zero", () => {
		expect(getUnavailableModeratorActionSummary()).toEqual({
			pendingProductSubmissions: null,
			pendingFoodWarningReports: null,
			pendingProfileImageReviews: null,
			totalPendingReviews: null,
			unavailable: true,
		});
	});
});
