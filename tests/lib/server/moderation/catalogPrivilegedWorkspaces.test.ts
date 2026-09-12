import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readCatalogReviewWork: vi.fn(),
	readCatalogProductReadinessPassport: vi.fn(),
	readPrivilegedToolReviewSummary: vi.fn(),
	runPrivilegedQueueAdmission: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock("$lib/server/moderation/catalogReviewWork.server", () => ({
	readCatalogReviewWork: mocks.readCatalogReviewWork,
}));

vi.mock("$lib/server/moderation/privilegedToolReviewSummary.server", () => ({
	readPrivilegedToolReviewSummary: mocks.readPrivilegedToolReviewSummary,
}));

vi.mock("$lib/server/moderation/privilegedQueueAdmission.server", () => ({
	runPrivilegedQueueAdmission: mocks.runPrivilegedQueueAdmission,
}));

vi.mock(
	"$lib/server/moderation/catalogProductReadinessPassport.server",
	() => ({
		readCatalogProductReadinessPassport:
			mocks.readCatalogProductReadinessPassport,
	}),
);

import { loadCatalogDataOperationsWorkspace } from "$lib/server/moderation/catalogDataOperationsWorkspace.server";
import { loadCatalogReviewWorkWorkspace } from "$lib/server/moderation/catalogReviewWorkWorkspace.server";
import { loadCatalogProductReadinessPassportWorkspace } from "$lib/server/moderation/catalogProductReadinessPassportWorkspace.server";

describe("catalog privileged workspaces", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readPrivilegedToolReviewSummary.mockResolvedValue({
			pendingCatalogDataOperations: 7,
			catalogDataOperationSubjects: [],
			catalogDataOperationSubjectsTruncated: true,
		});
	});

	it("requires data-operations permission before loading operator work", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({
			user: { id: "developer-id" },
			role: "developer",
			permissions: ["data_operations.catalog_health.read"],
		});
		const supabase = {};

		await expect(
			loadCatalogDataOperationsWorkspace({ locals: { supabase } } as never),
		).resolves.toEqual({
			viewerRole: "developer",
			actionCount: 7,
			actionSubjects: [],
			actionSubjectsTruncated: true,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.read",
			"/profile/privileged-tools/data-operations",
		);
		expect(mocks.readPrivilegedToolReviewSummary).toHaveBeenCalledWith(
			supabase,
		);
	});

	it("keeps the data-operations count unknown when the secure summary cannot be read", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({ role: "developer" });
		mocks.readPrivilegedToolReviewSummary.mockRejectedValue(
			new Error("offline"),
		);

		await expect(
			loadCatalogDataOperationsWorkspace({
				locals: { supabase: {} },
			} as never),
		).resolves.toMatchObject({
			actionCount: null,
			actionSubjects: null,
			actionSubjectsTruncated: false,
		});
	});

	it("requires catalog-review permission before loading human decisions", async () => {
		const reviewWork = {
			conflicts: [],
			providerChanges: [],
			safetyMatches: [],
			counts: { conflicts: 0, providerChanges: 0, safetyMatches: 0 },
			issueLimit: 20,
		};
		mocks.requireModeratorPermission.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
			permissions: ["moderation.catalog.review"],
		});
		mocks.readCatalogReviewWork.mockResolvedValue(reviewWork);
		const supabase = {};

		await expect(
			loadCatalogReviewWorkWorkspace({ locals: { supabase } } as never),
		).resolves.toEqual({ viewerRole: "moderator", reviewWork });
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"moderation.catalog.review",
			"/profile/privileged-tools/catalog-review-work",
		);
		expect(mocks.readCatalogReviewWork).toHaveBeenCalledWith(supabase);
	});

	it("does not read either domain when its access guard fails", async () => {
		mocks.requireModeratorPermission.mockRejectedValue({ status: 403 });

		await expect(
			loadCatalogDataOperationsWorkspace({ locals: { supabase: {} } } as never),
		).rejects.toMatchObject({ status: 403 });
		await expect(
			loadCatalogReviewWorkWorkspace({ locals: { supabase: {} } } as never),
		).rejects.toMatchObject({ status: 403 });
		expect(mocks.readCatalogReviewWork).not.toHaveBeenCalled();
	});

	it("uses the caller's exact permission and return route for product passports", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({ role: "developer" });
		mocks.readCatalogProductReadinessPassport.mockResolvedValue({
			product: { id: "product-id" },
		});
		const supabase = {};

		await expect(
			loadCatalogProductReadinessPassportWorkspace(
				{ locals: { supabase }, params: { productId: "product-id" } } as never,
				"data_operations.catalog_health.read",
				"/profile/privileged-tools/data-operations",
			),
		).resolves.toEqual({
			viewerRole: "developer",
			passport: { product: { id: "product-id" } },
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.read",
			"/profile/privileged-tools/data-operations",
		);
		expect(mocks.readCatalogProductReadinessPassport).toHaveBeenCalledWith(
			supabase,
			"product-id",
		);
		expect(mocks.runPrivilegedQueueAdmission).toHaveBeenCalledWith(supabase, [
			"catalog_review",
		]);
	});
});
