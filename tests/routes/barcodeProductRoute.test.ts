import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	adminClient: { source: "trusted-server" },
	getSupabaseAdminClient: vi.fn(),
	lookupBarcodeProductDraft: vi.fn(),
	readActiveProductSafetyAlertsByBarcode: vi.fn(),
	persistFoodImageAsset: vi.fn(),
	completeServerBackgroundTask: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

vi.mock("$lib/server/products/barcodeProduct.server", () => ({
	lookupBarcodeProductDraft: mocks.lookupBarcodeProductDraft,
}));

vi.mock("$lib/server/products/productSafetyAlerts.server", () => ({
	readActiveProductSafetyAlertsByBarcode:
		mocks.readActiveProductSafetyAlertsByBarcode,
}));

vi.mock("$lib/server/products/foodImages.server", () => ({
	persistFoodImageAsset: mocks.persistFoodImageAsset,
}));

vi.mock("$lib/server/runtime/backgroundTask.server", () => ({
	completeServerBackgroundTask: mocks.completeServerBackgroundTask,
}));

import { GET } from "../../src/routes/api/products/barcode/[barcode]/+server";

describe("barcode product route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.adminClient);
		mocks.completeServerBackgroundTask.mockImplementation(
			async (task: Promise<unknown>) => await task,
		);
		mocks.persistFoodImageAsset.mockResolvedValue(undefined);
		mocks.readActiveProductSafetyAlertsByBarcode.mockResolvedValue({
			status: "checked",
			alerts: [],
		});
	});

	it("reads protected catalog data through the trusted server boundary", async () => {
		mocks.lookupBarcodeProductDraft.mockResolvedValue({
			image: undefined,
			name: "Strawberry Jelly",
			brandOwner: "Example Brand",
			source: "shared-catalog",
			sourceReference: "shared-product-id",
		});
		const locals = {
			getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			supabase: { source: "authenticated-browser" },
		};

		const response = await GET({
			locals,
			params: { barcode: "00021130493609" },
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.lookupBarcodeProductDraft).toHaveBeenCalledWith(
			mocks.adminClient,
			"00021130493609",
		);
		expect(mocks.readActiveProductSafetyAlertsByBarcode).toHaveBeenCalledWith(
			"00021130493609",
			mocks.adminClient,
		);
		expect(mocks.lookupBarcodeProductDraft).not.toHaveBeenCalledWith(
			locals.supabase,
			"00021130493609",
		);
		expect(mocks.persistFoodImageAsset).toHaveBeenCalledWith({
			image: undefined,
			barcode: "00021130493609",
			productName: "Strawberry Jelly",
			brandName: "Example Brand",
			sharedProductId: "shared-product-id",
		});
		expect(mocks.completeServerBackgroundTask).toHaveBeenCalledTimes(1);
	});

	it("returns the product when noncritical image persistence fails", async () => {
		mocks.lookupBarcodeProductDraft.mockResolvedValue({
			image: undefined,
			name: "Strawberry Jelly",
			brandOwner: "Example Brand",
			source: "usda",
			sourceReference: "123",
		});
		mocks.persistFoodImageAsset.mockRejectedValue(
			new Error("image cache unavailable"),
		);
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

		const response = await GET({
			locals: {
				getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			},
			params: { barcode: "00021130493609" },
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			status: "found",
			draft: { name: "Strawberry Jelly" },
		});
		expect(warning).toHaveBeenCalledWith(
			"Food image cache could not be updated after barcode lookup.",
			"image cache unavailable",
		);
		warning.mockRestore();
	});

	it.each([
		["860014523113", "00860014523113"],
		["860014523120", "00860014523120"],
		["850035324554", "00850035324554"],
		["04006381333931", "04006381333931"],
	])(
		"returns an expected not-found result for %s without turning manual entry into a 404",
		async (requestedBarcode, canonicalBarcode) => {
			mocks.lookupBarcodeProductDraft.mockResolvedValue(null);

			const response = await GET({
				locals: {
					getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
				},
				params: { barcode: requestedBarcode },
			} as never);

			expect(response.status).toBe(200);
			await expect(response.json()).resolves.toEqual({
				status: "not-found",
				barcode: canonicalBarcode,
				safetyCheck: { status: "checked", alerts: [] },
			});
			expect(mocks.lookupBarcodeProductDraft).toHaveBeenCalledWith(
				mocks.adminClient,
				canonicalBarcode,
			);
			expect(mocks.persistFoodImageAsset).not.toHaveBeenCalled();
		},
	);

	it("returns an exact official recall even when no product source has the barcode", async () => {
		mocks.lookupBarcodeProductDraft.mockResolvedValue(null);
		mocks.readActiveProductSafetyAlertsByBarcode.mockResolvedValue({
			status: "checked",
			alerts: [
				{
					id: "recall-1",
					providerKey: "fda-recalls",
					sourceName: "FDA Recalls",
					sourceAttribution: "U.S. Food and Drug Administration",
					alertType: "recall",
					status: "ongoing",
					productDescription: "Everything Sprouts Alfalfa Sprouts",
					reason: "Potential Salmonella and E. coli contamination.",
					sourceUrl: "https://www.fda.gov/example-recall",
					matchType: "exact_gtin",
					requiresPackageCheck: true,
					detectedAt: "2026-08-25T00:00:00.000Z",
				},
			],
		});

		const response = await GET({
			locals: {
				getVerifiedUser: vi.fn().mockResolvedValue({ id: "user-id" }),
			},
			params: { barcode: "860014523120" },
		} as never);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			status: "not-found",
			barcode: "00860014523120",
			safetyCheck: {
				status: "checked",
				alerts: [
					{
						productDescription: "Everything Sprouts Alfalfa Sprouts",
						matchType: "exact_gtin",
					},
				],
			},
		});
		expect(mocks.persistFoodImageAsset).not.toHaveBeenCalled();
	});
});
