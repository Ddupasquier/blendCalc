import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

import { actions } from "../../src/routes/profile/privileged-tools/catalog-review-work/products/[productId]/+page.server";

const createRequest = (fields: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) formData.set(key, value);
	return new Request("http://localhost/catalog-review", {
		method: "POST",
		body: formData,
	});
};

describe("catalog review product route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorPermission.mockResolvedValue({ role: "admin" });
	});

	it("requires a conflict and an evidence note before writing", async () => {
		const rpc = vi.fn();
		const result = await actions.resolveConflictWithoutCorrection({
			locals: { supabase: { rpc } },
			params: { productId: "product-id" },
			request: createRequest({
				conflictId: "conflict-id",
				resolutionNote: " ",
			}),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(rpc).not.toHaveBeenCalled();
	});

	it("binds the conflict decision to the focused product", async () => {
		const rpc = vi
			.fn()
			.mockResolvedValue({ data: { reviewed: true }, error: null });
		await expect(
			actions.resolveConflictWithoutCorrection({
				locals: { supabase: { rpc } },
				params: { productId: "product-id" },
				request: createRequest({
					conflictId: "conflict-id",
					resolutionNote:
						"The package label is the most recent exact evidence.",
				}),
			} as never),
		).resolves.toEqual({
			catalogReviewSuccess:
				"The stored catalog value remains unchanged and this conflict is resolved. API readiness was recalculated.",
		});
		expect(rpc).toHaveBeenCalledWith(
			"resolve_catalog_conflict_without_correction",
			{
				p_conflict_id: "conflict-id",
				p_shared_product_id: "product-id",
				p_resolution_note:
					"The package label is the most recent exact evidence.",
			},
		);
	});

	it("tells the reviewer to finish a linked correction", async () => {
		const result = await actions.resolveConflictWithoutCorrection({
			locals: {
				supabase: {
					rpc: vi.fn().mockResolvedValue({
						data: null,
						error: { message: "Review the linked catalog correction first" },
					}),
				},
			},
			params: { productId: "product-id" },
			request: createRequest({
				conflictId: "conflict-id",
				resolutionNote: "Current evidence remains authoritative.",
			}),
		} as never);

		expect(result).toMatchObject({
			status: 409,
			data: {
				catalogReviewError: expect.stringMatching(/linked catalog correction/u),
			},
		});
	});
});
