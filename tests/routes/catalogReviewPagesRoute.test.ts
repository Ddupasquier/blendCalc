import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), read: vi.fn() }));
vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorApiPermission: mocks.guard,
}));
vi.mock("$lib/server/moderation/catalogReviewPages.server", () => ({
	readCatalogReviewPage: mocks.read,
}));
import { GET } from "../../src/routes/api/moderation/catalog-review-pages/+server";
const call = (query: string) =>
	GET({
		locals: { supabase: {} },
		url: new URL(
			"http://localhost/api/moderation/catalog-review-pages?" + query,
		),
	} as never);
describe("catalog page read boundary", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.guard.mockResolvedValue(undefined);
		mocks.read.mockResolvedValue({ items: [], total: 0, nextCursor: null });
	});
	it("uses caller session and exact permission, and never caches privileged evidence", async () => {
		const response = await call("queue=products");
		expect(mocks.guard).toHaveBeenCalledWith(
			{ supabase: {} },
			"moderation.catalog.review",
		);
		expect(mocks.read).toHaveBeenCalledWith({}, "products", null, null);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
	it.each([
		"queue=unknown",
		"queue=conflicts",
		"queue=products&product=99978000-0000-4000-8000-000000000001",
		"queue=safetyMatches&product=x",
		"queue=products&cursor=%7B%7D",
	])("refuses unsupported paging input: %s", async (input) => {
		await expect(call(input)).rejects.toMatchObject({ status: 400 });
		expect(mocks.read).not.toHaveBeenCalled();
	});
	it("fails closed before reading when permission or MFA is unavailable", async () => {
		mocks.guard.mockRejectedValue({ status: 403 });
		await expect(call("queue=products")).rejects.toMatchObject({ status: 403 });
		expect(mocks.read).not.toHaveBeenCalled();
	});
});
