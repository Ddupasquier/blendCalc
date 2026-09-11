import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHealthRepairDryRunFixture } from "../../../fixtures/catalogHealthRepair";
import { catalogProductReadinessPassportFixture } from "../../../fixtures/catalogProductReadinessPassport";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readCatalogProductReadinessPassport: vi.fn(),
	runCatalogHealthRepair: vi.fn(),
	finishCatalogProductReview: vi.fn(),
	finishCatalogProductDiagnosticReview: vi.fn(),
	readCatalogCorrectionHandoff: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock(
	"$lib/server/moderation/catalogProductReadinessPassport.server",
	() => ({
		readCatalogProductReadinessPassport:
			mocks.readCatalogProductReadinessPassport,
	}),
);

vi.mock("$lib/server/moderation/catalogCorrectionHandoff.server", () => ({
	readCatalogCorrectionHandoff: mocks.readCatalogCorrectionHandoff,
}));

vi.mock(
	"$lib/server/moderation/catalogProductReviewDisposition.server",
	async (importOriginal) => {
		const original =
			await importOriginal<
				typeof import("$lib/server/moderation/catalogProductReviewDisposition.server")
			>();
		return {
			...original,
			finishCatalogProductReview: mocks.finishCatalogProductReview,
			finishCatalogProductDiagnosticReview:
				mocks.finishCatalogProductDiagnosticReview,
		};
	},
);

vi.mock(
	"$lib/server/moderation/catalogHealthRepair.server",
	async (importOriginal) => {
		const original =
			await importOriginal<
				typeof import("$lib/server/moderation/catalogHealthRepair.server")
			>();
		return {
			...original,
			runCatalogHealthRepair: mocks.runCatalogHealthRepair,
		};
	},
);

import {
	finishCatalogProductReviewAction,
	loadCatalogProductRepairWorkspace,
	runCatalogProductRepairAction,
} from "$lib/server/moderation/catalogProductRepairWorkspace.server";

const createFormRequest = (values: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(values)) formData.set(key, value);
	return new Request(
		"http://localhost/profile/privileged-tools/data-operations/product",
		{
			method: "POST",
			body: formData,
		},
	);
};

describe("catalog product repair workspace", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.requireModeratorPermission.mockResolvedValue({
			role: "developer",
			permissions: [
				"data_operations.catalog_health.read",
				"data_operations.catalog_health.repair",
			],
		});
		mocks.readCatalogProductReadinessPassport.mockResolvedValue(
			catalogProductReadinessPassportFixture,
		);
		mocks.readCatalogCorrectionHandoff.mockResolvedValue({
			applicationFoodId: 123,
			pendingSubmissionId: null,
			findings: [],
		});
	});

	it("loads the product passport and exposes repair capability from exact permissions", async () => {
		const supabase = {};
		await expect(
			loadCatalogProductRepairWorkspace({
				locals: { supabase },
				params: { productId: "product-id" },
			} as never),
		).resolves.toEqual({
			viewerRole: "developer",
			canRunRepairs: true,
			passport: catalogProductReadinessPassportFixture,
			correctionHandoff: {
				applicationFoodId: 123,
				pendingSubmissionId: null,
				findings: [],
			},
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.read",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(mocks.readCatalogProductReadinessPassport).toHaveBeenCalledWith(
			supabase,
			"product-id",
		);
		expect(mocks.readCatalogCorrectionHandoff).toHaveBeenCalledWith(
			"product-id",
			catalogProductReadinessPassportFixture.issues,
		);
	});

	it("runs a dry run only after checking the repair permission", async () => {
		mocks.runCatalogHealthRepair.mockResolvedValue(
			catalogHealthRepairDryRunFixture,
		);
		const supabase = {};
		const occurrenceKey =
			catalogProductReadinessPassportFixture.issues[0].occurrenceKey;
		await expect(
			runCatalogProductRepairAction({
				locals: { supabase },
				params: { productId: "product-id" },
				request: createFormRequest({
					occurrenceKey,
					mode: "dry_run",
				}),
			} as never),
		).resolves.toEqual({
			catalogRepairOccurrenceKey: occurrenceKey,
			catalogRepairResult: catalogHealthRepairDryRunFixture,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.repair",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(mocks.runCatalogHealthRepair).toHaveBeenCalledWith(supabase, {
			occurrenceKey,
			apply: false,
			dryRunId: null,
		});
	});

	it("requires a valid dry-run identifier before apply", async () => {
		const result = await runCatalogProductRepairAction({
			locals: { supabase: {} },
			params: { productId: "product-id" },
			request: createFormRequest({ occurrenceKey: "issue", mode: "apply" }),
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				catalogRepairOccurrenceKey: "issue",
				catalogRepairError: expect.stringContaining("fresh safety check"),
			},
		});
		expect(mocks.runCatalogHealthRepair).not.toHaveBeenCalled();
	});

	it("rejects an issue that does not belong to the current product passport", async () => {
		const result = await runCatalogProductRepairAction({
			locals: { supabase: {} },
			params: { productId: "product-id" },
			request: createFormRequest({
				occurrenceKey: "another-product:issue",
				mode: "dry_run",
			}),
		} as never);

		expect(result).toMatchObject({
			status: 409,
			data: {
				catalogRepairError: expect.stringContaining("options have changed"),
			},
		});
		expect(mocks.runCatalogHealthRepair).not.toHaveBeenCalled();
	});

	it("finishes an inconclusive review through the guarded product action", async () => {
		mocks.finishCatalogProductReview.mockResolvedValue({
			outcome: "accepted_withheld",
			issueCount: 3,
			reviewedAt: "2026-09-10T18:00:00.000Z",
		});
		const supabase = {};

		await expect(
			finishCatalogProductReviewAction({
				locals: { supabase },
				params: { productId: "product-id" },
				request: createFormRequest({
					reviewCategory: "publication",
					reviewNote:
						"The current package and approved sources do not include potassium.",
				}),
			} as never),
		).resolves.toMatchObject({
			catalogReviewDispositionResult: {
				outcome: "accepted_withheld",
				issueCount: 3,
			},
			catalogReviewDispositionSuccess: expect.stringContaining(
				"removed from the work queue",
			),
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.repair",
			"/profile/privileged-tools/data-operations/products/product-id",
		);
		expect(mocks.finishCatalogProductReview).toHaveBeenCalledWith(supabase, {
			sharedProductId: "product-id",
			reviewNote:
				"The current package and approved sources do not include potassium.",
		});
	});

	it("finishes nonpublication diagnostics through their separate durable outcome", async () => {
		mocks.finishCatalogProductDiagnosticReview.mockResolvedValue({
			outcome: "accepted_evidence_gap",
			issueCount: 2,
			reviewedAt: "2026-09-10T18:00:00.000Z",
		});

		await expect(
			finishCatalogProductReviewAction({
				locals: { supabase: {} },
				params: { productId: "product-id" },
				request: createFormRequest({
					reviewCategory: "diagnostic",
					reviewNote:
						"No stored revision summary or exact observation can reconstruct the change.",
				}),
			} as never),
		).resolves.toMatchObject({
			catalogReviewDispositionCategory: "diagnostic",
			catalogReviewDispositionResult: {
				outcome: "accepted_evidence_gap",
				issueCount: 2,
			},
			catalogReviewDispositionSuccess: expect.stringContaining(
				"public API availability are unchanged",
			),
		});
		expect(mocks.finishCatalogProductDiagnosticReview).toHaveBeenCalled();
		expect(mocks.finishCatalogProductReview).not.toHaveBeenCalled();
	});

	it("rejects an uninformative terminal review note before the database call", async () => {
		const result = await finishCatalogProductReviewAction({
			locals: { supabase: {} },
			params: { productId: "product-id" },
			request: createFormRequest({
				reviewCategory: "publication",
				reviewNote: "No proof",
			}),
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: {
				catalogReviewDispositionError: expect.stringContaining(
					"at least 10 characters",
				),
			},
		});
		expect(mocks.finishCatalogProductReview).not.toHaveBeenCalled();
	});
});
