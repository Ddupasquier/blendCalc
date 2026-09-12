import { describe, expect, it, vi } from "vitest";
import { readCatalogProductReadinessPassport } from "$lib/server/moderation/catalogProductReadinessPassport.server";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

describe("catalog product readiness passport repository", () => {
	it("requests one bounded product passport through the authenticated client", async () => {
		const rpc = vi.fn().mockImplementation((functionName: string) =>
			Promise.resolve({
				data:
					functionName === "get_catalog_product_revision_context"
						? catalogProductReadinessPassportFixture.revisionHistory
						: functionName === "get_catalog_product_api_withholding_reasons"
							? catalogProductReadinessPassportFixture.product
									.apiWithholdingReasons
							: catalogProductReadinessPassportFixture,
				error: null,
			}),
		);

		await expect(
			readCatalogProductReadinessPassport({ rpc } as never, "product-id"),
		).resolves.toEqual(catalogProductReadinessPassportFixture);
		expect(rpc).toHaveBeenCalledWith(
			"get_blendcalc_api_catalog_product_readiness_passport",
			{
				p_shared_product_id: "product-id",
			},
		);
		expect(rpc).toHaveBeenCalledWith("get_catalog_product_revision_context", {
			p_shared_product_id: "product-id",
		});
		expect(rpc).toHaveBeenCalledWith(
			"get_catalog_product_api_withholding_reasons",
			{ p_shared_product_id: "product-id" },
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

	it("keeps the readiness workspace available while revision context is still rolling out", async () => {
		const legacyPassport = {
			...catalogProductReadinessPassportFixture,
			revisionHistory: undefined,
			revisionHistoryAvailable: undefined,
		};
		const rpc = vi.fn().mockImplementation((functionName: string) =>
			Promise.resolve(
				functionName === "get_catalog_product_revision_context"
					? {
							data: null,
							error: {
								code: "PGRST202",
								message:
									"Could not find the function get_catalog_product_revision_context",
							},
						}
					: functionName === "get_catalog_product_api_withholding_reasons"
						? {
								data: catalogProductReadinessPassportFixture.product
									.apiWithholdingReasons,
								error: null,
							}
						: { data: legacyPassport, error: null },
			),
		);

		await expect(
			readCatalogProductReadinessPassport({ rpc } as never, "product-id"),
		).resolves.toMatchObject({
			product: { id: "product-id" },
			revisionHistory: [],
			revisionHistoryAvailable: false,
		});
	});

	it("derives API withholding reasons while the detailed reason RPC is still rolling out", async () => {
		const rpc = vi.fn().mockImplementation((functionName: string) =>
			Promise.resolve(
				functionName === "get_catalog_product_api_withholding_reasons"
					? {
							data: null,
							error: {
								code: "PGRST202",
								message:
									"Could not find the function get_catalog_product_api_withholding_reasons",
							},
						}
					: functionName === "get_catalog_product_revision_context"
						? {
								data: catalogProductReadinessPassportFixture.revisionHistory,
								error: null,
							}
						: {
								data: catalogProductReadinessPassportFixture,
								error: null,
							},
			),
		);

		const passport = await readCatalogProductReadinessPassport(
			{ rpc } as never,
			"product-id",
		);

		expect(passport.product.apiWithholdingReasons).toEqual(
			expect.arrayContaining([
				"Selected nutrition is missing source evidence",
				"1 stored field has conflicting source values.",
			]),
		);
	});
});
