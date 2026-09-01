import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	getSupabaseAdminClient: vi.fn(),
	getProductReferenceCatalog: vi.fn(),
	lookupBarcodeProductDraft: vi.fn(),
}));

vi.mock("$lib/server/products/barcodeProduct.server", () => ({
	lookupBarcodeProductDraft: mocks.lookupBarcodeProductDraft,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));
vi.mock("$lib/server/products/productReferenceCatalog.server", () => ({
	getProductReferenceCatalog: mocks.getProductReferenceCatalog,
}));

import { POST } from "../../src/routes/api/products/barcode/[barcode]/share-validation/+server";

describe("barcode share-validation privacy boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
		mocks.getProductReferenceCatalog.mockResolvedValue({
			sources: {
				usda: {
					canonicalStorageAllowed: true,
					canonicalLicenseName: "CC0-1.0",
				},
			},
		});
		mocks.lookupBarcodeProductDraft.mockResolvedValue({
			name: "Tomato Sauce",
			source: "usda",
			sourceKey: "usda",
		});
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
		expect(await response.json()).toMatchObject({
			status: "matched",
			defaultSharingAllowed: true,
		});
		expect(mocks.lookupBarcodeProductDraft).toHaveBeenCalledWith(
			mocks.adminClient,
			"00021130493609",
		);
		expect(mocks.lookupBarcodeProductDraft).not.toHaveBeenCalledWith(
			locals.supabase,
			"00021130493609",
		);
	});

	it("does not default sharing on for a restricted or mixed source", async () => {
		mocks.getProductReferenceCatalog.mockResolvedValue({
			sources: {
				usda: {
					canonicalStorageAllowed: true,
					canonicalLicenseName: "CC0-1.0",
				},
				"open-food-facts": {
					canonicalStorageAllowed: false,
					canonicalLicenseName: "ODbL-1.0",
				},
			},
		});
		mocks.lookupBarcodeProductDraft.mockResolvedValue({
			name: "Tomato Sauce",
			source: "usda",
			sourceKey: "usda",
			fieldProvenance: {
				ingredients: {
					source: "open-food-facts",
					confidence: "imported",
				},
			},
		});

		const response = await POST({
			locals: {
				getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			},
			params: { barcode: "00021130493609" },
			request: new Request("http://localhost", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ productName: "Tomato Sauce" }),
			}),
		} as never);

		expect(await response.json()).toMatchObject({
			status: "matched",
			defaultSharingAllowed: false,
		});
	});
});
