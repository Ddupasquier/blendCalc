import { describe, expect, it, vi } from "vitest";
vi.mock("$lib/server/moderation/catalogCorrectionHandoff.server", () => ({
	readCatalogCorrectionHandoff: vi.fn(),
}));
import {
	readCatalogReviewPage,
	readCatalogReviewProductPages,
} from "$lib/server/moderation/catalogReviewPages.server";
import { readCatalogCorrectionHandoff } from "$lib/server/moderation/catalogCorrectionHandoff.server";
const empty = {
	items: [],
	total: 0,
	counts: { conflicts: 0, providerChanges: 0, safetyMatches: 0 },
	nextCursor: null,
	revision: "a".repeat(32),
};
describe("catalog server page contract", () => {
	it("reads three bounded product queues without repeating workspace admission", async () => {
		vi.mocked(readCatalogCorrectionHandoff).mockResolvedValue({
			findings: [],
		} as never);
		const rpc = vi.fn().mockResolvedValue({ data: empty, error: null });
		await expect(
			readCatalogReviewProductPages({ rpc } as never, "product-id"),
		).resolves.toEqual({
			conflicts: empty,
			providerChanges: empty,
			safetyMatches: empty,
		});
		expect(rpc).toHaveBeenCalledTimes(3);
		for (const queue of ["conflicts", "providerChanges", "safetyMatches"])
			expect(rpc).toHaveBeenCalledWith("get_catalog_review_page", {
				p_queue: queue,
				p_product_id: "product-id",
				p_cursor: undefined,
				p_limit: 20,
			});
	});
	it("reads complete provider-change evidence and refuses incomplete change details", async () => {
		const item = {
			id: "99978500-0000-4000-8000-000000000001",
			sharedProductId: "99978000-0000-4000-8000-000000000001",
			barcode: "09790000000001",
			productName: "QA Pagination 1",
			sourceName: "USDA",
			createdAt: "2026-10-03T12:00:00.123456Z",
			observedAt: "2026-10-03T12:00:00.123456Z",
			correctionStatus: null,
			submissionId: null,
			materialFieldPaths: ["ingredients"],
			changeSummary: {
				changes: [
					{
						field: "ingredients",
						label: "Ingredients",
						severity: "high",
						previousValue: "old",
						observedValue: "new",
					},
				],
			},
		};
		const data = {
			...empty,
			items: [item],
			total: 1,
			counts: { ...empty.counts, providerChanges: 1 },
		};
		const rpc = vi
			.fn()
			.mockResolvedValueOnce({ data, error: null })
			.mockResolvedValueOnce({
				data: {
					...data,
					items: [
						{
							...item,
							changeSummary: {
								changes: [
									{
										fieldPath: "ingredients",
										previousValue: "old",
										nextValue: "new",
									},
								],
							},
						},
					],
				},
				error: null,
			});
		await expect(
			readCatalogReviewPage(
				{ rpc } as never,
				"providerChanges",
				item.sharedProductId,
			),
		).resolves.toMatchObject({ items: [item], total: 1 });
		await expect(
			readCatalogReviewPage(
				{ rpc } as never,
				"providerChanges",
				item.sharedProductId,
			),
		).rejects.toMatchObject({ status: 502 });
	});
	it("requests a bounded authenticated inbox, never the global capped summary", async () => {
		const rpc = vi.fn().mockResolvedValue({ data: empty, error: null });
		await expect(
			readCatalogReviewPage({ rpc } as never, "products"),
		).resolves.toEqual(empty);
		expect(rpc).toHaveBeenCalledWith("get_catalog_review_page", {
			p_queue: "products",
			p_product_id: undefined,
			p_cursor: undefined,
			p_limit: 20,
		});
	});
	it.each([
		null,
		{},
		{ ...empty, total: -1 },
		{ ...empty, items: Array(21).fill({}) },
		{ ...empty, nextCursor: {} },
		{ ...empty, revision: "x" },
		{ ...empty, counts: { ...empty.counts, conflicts: 1.5 } },
	])("fails closed on broken server payload: %j", async (data) => {
		const rpc = vi.fn().mockResolvedValue({ data, error: null });
		await expect(
			readCatalogReviewPage({ rpc } as never, "products"),
		).rejects.toMatchObject({ status: 502 });
	});
	it("hides database/provider diagnostic details", async () => {
		const rpc = vi
			.fn()
			.mockResolvedValue({ data: null, error: { message: "private detail" } });
		await expect(
			readCatalogReviewPage({ rpc } as never, "products"),
		).rejects.toMatchObject({ status: 502 });
	});
});
