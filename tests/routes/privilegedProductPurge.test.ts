import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorApiPermission: vi.fn(),
	rpc: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorApiPermission: mocks.requireModeratorApiPermission,
}));

import { POST } from "../../src/routes/api/moderation/product-purge/+server";

const request = (body: unknown) =>
	new Request("http://localhost/api/moderation/product-purge", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("privileged catalog product purge route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorApiPermission.mockResolvedValue({
			user: { id: "operator" },
			role: "admin",
			permissions: ["data_operations.catalog_health.repair"],
		});
	});

	it("requires repair permission and returns the exact read-only preview", async () => {
		mocks.rpc.mockResolvedValue({
			data: {
				normalizedBarcode: "00076808006568",
				found: true,
				productName: "Test product",
				brandOwner: "Test brand",
				counts: { products: 1 },
			},
			error: null,
		});

		const response = await POST({
			locals: { supabase: { rpc: mocks.rpc } },
			request: request({ action: "preview", barcode: "076808006568" }),
		} as never);
		const body = await response.json();

		expect(mocks.requireModeratorApiPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.repair",
		);
		expect(mocks.rpc).toHaveBeenCalledWith("preview_catalog_product_purge", {
			p_barcode: "00076808006568",
		});
		expect(body).toEqual(
			expect.objectContaining({
				action: "preview",
				preview: expect.objectContaining({ productName: "Test product" }),
			}),
		);
	});

	it("rejects an invalid UPC before any database call", async () => {
		const response = await POST({
			locals: { supabase: { rpc: mocks.rpc } },
			request: request({ action: "preview", barcode: "123" }),
		} as never);

		expect(response.status).toBe(400);
		expect(mocks.rpc).not.toHaveBeenCalled();
	});
});
