import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readCatalogReviewWork: vi.fn(),
	loadCatalogProductReadinessPassportWorkspace: vi.fn(),
	readCatalogCorrectionHandoff: vi.fn(),
	getApprovedCatalogRecordByApplicationFoodId: vi.fn(),
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));
vi.mock("$lib/server/moderation/catalogReviewWork.server", () => ({
	readCatalogReviewWork: mocks.readCatalogReviewWork,
}));
vi.mock(
	"$lib/server/moderation/catalogProductReadinessPassportWorkspace.server",
	() => ({
		loadCatalogProductReadinessPassportWorkspace:
			mocks.loadCatalogProductReadinessPassportWorkspace,
	}),
);
vi.mock("$lib/server/moderation/catalogCorrectionHandoff.server", () => ({
	readCatalogCorrectionHandoff: mocks.readCatalogCorrectionHandoff,
}));
vi.mock("$lib/server/products/catalogRead.server", () => ({
	getApprovedCatalogRecordByApplicationFoodId:
		mocks.getApprovedCatalogRecordByApplicationFoodId,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import {
	actions,
	load,
} from "../../src/routes/profile/privileged-tools/catalog-review-work/products/[productId]/+page.server";

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
		mocks.getSupabaseAdminClient.mockReturnValue({ admin: true });
	});

	it("loads the canonical correction food into the privileged product route", async () => {
		const supabase = {};
		const food = {
			fdcId: 373595,
			description: "Greek Yogurt",
			foodNutrients: [],
		};
		mocks.loadCatalogProductReadinessPassportWorkspace.mockResolvedValue({
			viewerRole: "admin",
			passport: { issues: [] },
		});
		mocks.readCatalogReviewWork.mockResolvedValue({
			conflicts: [],
			providerChanges: [],
			safetyMatches: [],
			counts: { conflicts: 0, providerChanges: 0, safetyMatches: 0 },
			issueLimit: 20,
		});
		mocks.readCatalogCorrectionHandoff.mockResolvedValue({
			applicationFoodId: 373595,
			pendingSubmissionId: null,
			findings: [],
		});
		mocks.getApprovedCatalogRecordByApplicationFoodId.mockResolvedValue({
			food,
		});

		const result = await load({
			locals: { supabase },
			params: { productId: "product-id" },
		} as never);

		expect(
			mocks.getApprovedCatalogRecordByApplicationFoodId,
		).toHaveBeenCalledWith({ admin: true }, 373595);
		expect(result).toMatchObject({
			correctionFood: food,
		});
	});

	it("requires a complete decision array before finishing", async () => {
		const rpc = vi.fn();
		const result = await actions.finishConflictReview({
			locals: { supabase: { rpc } },
			params: { productId: "product-id" },
			request: createRequest({ decisions: "[]" }),
		} as never);

		expect(result).toMatchObject({ status: 400 });
		expect(rpc).not.toHaveBeenCalled();
	});

	it("records every decision atomically and opens the next product", async () => {
		const decisions = [
			{
				conflictId: "conflict-id",
				outcome: "keep_current",
				note: "The package label is the strongest current evidence.",
			},
		];
		const rpc = vi.fn().mockResolvedValue({
			data: { finished: true },
			error: null,
		});
		mocks.readCatalogReviewWork.mockResolvedValue({
			conflicts: [
				{
					id: "next-conflict",
					productId: "next-product",
					barcode: "00021130462506",
					productName: "Next product",
					fieldPath: "nutrient:1003",
					observedValues: [],
					severity: "high",
					createdAt: "2026-09-11T00:00:00Z",
				},
			],
			providerChanges: [],
			safetyMatches: [],
			counts: { conflicts: 1, providerChanges: 0, safetyMatches: 0 },
			issueLimit: 20,
		});

		await expect(
			actions.finishConflictReview({
				locals: { supabase: { rpc } },
				params: { productId: "product-id" },
				request: createRequest({ decisions: JSON.stringify(decisions) }),
			} as never),
		).rejects.toMatchObject({
			status: 303,
			location:
				"/profile/privileged-tools/catalog-review-work/products/next-product",
		});
		expect(rpc).toHaveBeenCalledWith("finish_catalog_conflict_review", {
			p_shared_product_id: "product-id",
			p_decisions: decisions,
		});
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
