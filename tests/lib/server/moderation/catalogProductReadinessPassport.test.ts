import { describe, expect, it, vi } from "vitest";
import { readCatalogProductReadinessPassport } from "$lib/server/moderation/catalogProductReadinessPassport.server";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("catalog product readiness passport repository", () => {
	it("requests one bounded product passport through the authenticated client", async () => {
		const rpc = vi.fn().mockResolvedValue({
			data: catalogProductReadinessPassportFixture,
			error: null,
		});

		await expect(
			readCatalogProductReadinessPassport({ rpc } as never, "product-id"),
		).resolves.toEqual(catalogProductReadinessPassportFixture);
		expect(rpc).toHaveBeenCalledWith(
			"get_blendcalc_api_catalog_product_readiness_passport",
			{
				p_shared_product_id: "product-id",
			},
		);
	});

	it("keeps missing products distinct from contract or database failures", async () => {
		await expect(
			readCatalogProductReadinessPassport(
				{
					rpc: vi
						.fn()
						.mockResolvedValue({ data: null, error: { code: "P0002" } }),
				} as never,
				"missing-product",
			),
		).rejects.toMatchObject({ status: 404 });

		await expect(
			readCatalogProductReadinessPassport(
				{
					rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
				} as never,
				"product-id",
			),
		).rejects.toMatchObject({ status: 502 });
	});
});
