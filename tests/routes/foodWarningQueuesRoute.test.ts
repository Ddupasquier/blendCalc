import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	authorize: vi.fn(),
	readPage: vi.fn(),
	admin: {},
}));
vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorApiPermission: mocks.authorize,
}));
vi.mock("$lib/server/moderation/foodWarningQueues.server", () => ({
	readFoodWarningQueuePage: mocks.readPage,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => mocks.admin,
}));
import { GET } from "../../src/routes/api/moderation/food-warning-queues/+server";

describe("food warning queue API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.authorize.mockResolvedValue({ role: "moderator" });
		mocks.readPage.mockResolvedValue({ items: [], total: 0, nextCursor: null });
	});
	it.each(["reports", "policyReviews", "productCorrections"])(
		"authorizes %s pages before reading private work and disables caching",
		async (queue) => {
			const response = await GET({
				locals: {},
				url: new URL(
					`http://localhost/api/moderation/food-warning-queues?queue=${queue}`,
				),
			} as never);
			expect(mocks.authorize).toHaveBeenCalledWith(
				{},
				"moderation.warnings.review",
			);
			expect(mocks.readPage).toHaveBeenCalledWith(
				{ supabase: mocks.admin },
				queue,
				null,
			);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
		},
	);
	it.each([
		"",
		"?queue=unknown",
		"?queue=reports&cursor=bad",
		"?queue=reports&cursor=null",
	])("rejects invalid paging input %s without a query", async (suffix) => {
		await expect(
			GET({
				locals: {},
				url: new URL(
					`http://localhost/api/moderation/food-warning-queues${suffix}`,
				),
			} as never),
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.readPage).not.toHaveBeenCalled();
	});
	it("never reads reports if authentication, role, or AAL2 checks fail", async () => {
		mocks.authorize.mockRejectedValue({ status: 403 });
		await expect(
			GET({
				locals: {},
				url: new URL(
					"http://localhost/api/moderation/food-warning-queues?queue=reports",
				),
			} as never),
		).rejects.toMatchObject({ status: 403 });
		expect(mocks.readPage).not.toHaveBeenCalled();
	});
});
