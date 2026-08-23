import { describe, expect, it, vi } from "vitest";
import { readCatalogReviewWork } from "$lib/server/moderation/catalogReviewWork.server";

const reviewWorkFixture = {
	conflicts: [],
	providerChanges: [],
	safetyMatches: [],
	counts: {
		conflicts: 0,
		providerChanges: 0,
		safetyMatches: 0,
	},
	issueLimit: 20,
};

describe("catalog review-work repository", () => {
	it("requests only the bounded catalog-review contract", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: reviewWorkFixture,
			error: null,
		});

		await expect(readCatalogReviewWork({ rpc } as never))
			.resolves.toEqual(reviewWorkFixture);
		expect(rpc).toHaveBeenCalledWith("get_catalog_review_work_summary", {
			p_limit: 20,
		});
	});

	it("returns the approved moderation error for database or contract failures", async () => {
		await expect(readCatalogReviewWork({
			rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "failed" } }),
		} as never)).rejects.toMatchObject({ status: 502 });

		await expect(readCatalogReviewWork({
			rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
		} as never)).rejects.toMatchObject({ status: 502 });
	});
});
