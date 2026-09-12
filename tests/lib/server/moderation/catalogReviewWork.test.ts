import { describe, expect, it, vi } from "vitest";
import { readCatalogReviewWork } from "$lib/server/moderation/catalogReviewWork.server";

const admissionMocks = vi.hoisted(() => ({
	runPrivilegedQueueAdmission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(
	"$lib/server/moderation/privilegedQueueAdmission.server",
	() => admissionMocks,
);

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

		const supabase = { rpc } as never;
		await expect(readCatalogReviewWork(supabase)).resolves.toEqual(
			reviewWorkFixture,
		);
		expect(admissionMocks.runPrivilegedQueueAdmission).toHaveBeenCalledWith(
			supabase,
			["catalog_review"],
		);
		expect(rpc).toHaveBeenCalledWith("get_catalog_review_work_summary", {
			p_limit: 20,
		});
	});

	it("returns the approved moderation error for database or contract failures", async () => {
		await expect(
			readCatalogReviewWork({
				rpc: vi
					.fn()
					.mockResolvedValue({ data: null, error: { message: "failed" } }),
			} as never),
		).rejects.toMatchObject({ status: 502 });

		await expect(
			readCatalogReviewWork({
				rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
			} as never),
		).rejects.toMatchObject({ status: 502 });
	});
});
