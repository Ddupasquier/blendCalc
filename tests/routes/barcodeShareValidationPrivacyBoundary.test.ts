import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	getSupabaseAdminClient: vi.fn(),
	lookupBarcodeProductDraft: vi.fn(),
}));

vi.mock("$lib/server/products/barcodeProduct.server", () => ({
	lookupBarcodeProductDraft: mocks.lookupBarcodeProductDraft,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { POST } from "../../src/routes/api/products/barcode/[barcode]/share-validation/+server";

describe("barcode share-validation privacy boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
		mocks.lookupBarcodeProductDraft.mockResolvedValue({ name: "Tomato Sauce" });
	});

	it("reads the raw catalog through the trusted server client", async () => {
		const locals = {
			getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			supabase: { source: "authenticated-browser" },
		};
		const response = await POST({
			locals,
			params: { barcode: "00021130493609" },
			request: new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ productName: "Tomato Sauce" }),
			}),
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.lookupBarcodeProductDraft).toHaveBeenCalledWith(
			mocks.adminClient,
			"00021130493609",
		);
		expect(mocks.lookupBarcodeProductDraft).not.toHaveBeenCalledWith(
			locals.supabase,
			"00021130493609",
		);
	});
});
