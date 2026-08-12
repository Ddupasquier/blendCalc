import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	annotateFoodsForUser: vi.fn(),
	getSupabaseAdminClient: vi.fn(),
	searchApprovedSharedProducts: vi.fn(),
}));

vi.mock("$lib/server/products/catalog.server", () => ({
	searchApprovedSharedProducts: mocks.searchApprovedSharedProducts,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	annotateFoodsForUser: mocks.annotateFoodsForUser,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { GET } from "../../src/routes/api/products/search/+server";

describe("internal product search privacy boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
		mocks.searchApprovedSharedProducts.mockResolvedValue([]);
		mocks.annotateFoodsForUser.mockResolvedValue([]);
	});

	it("uses the trusted server for raw catalog reads and the user session for personalization", async () => {
		const locals = {
			getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			supabase: { source: "authenticated-browser" },
		};
		const response = await GET({
			locals,
			url: new URL("http://localhost/api/products/search?q=tomato"),
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.searchApprovedSharedProducts).toHaveBeenCalledWith(
			mocks.adminClient,
			"tomato",
		);
		expect(mocks.annotateFoodsForUser).toHaveBeenCalledWith(
			locals.supabase,
			"user-id",
			[],
		);
	});
});
