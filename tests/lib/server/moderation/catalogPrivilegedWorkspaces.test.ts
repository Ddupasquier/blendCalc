import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogDataOperationsHealthFixture } from "../../../fixtures/catalogDataOperationsHealth";
import { catalogMonitorModerationFixture } from "../../../fixtures/catalogMonitorModeration";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readCatalogDataOperationsHealth: vi.fn(),
	readCatalogMonitorModerationSummary: vi.fn(),
	readCatalogReviewWork: vi.fn(),
	readCatalogProductReadinessPassport: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
  requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock("$lib/server/moderation/catalogDataOperations.server", () => ({
	readCatalogDataOperationsHealth: mocks.readCatalogDataOperationsHealth,
	readCatalogMonitorModerationSummary: mocks.readCatalogMonitorModerationSummary,
}));

vi.mock("$lib/server/moderation/catalogReviewWork.server", () => ({
	readCatalogReviewWork: mocks.readCatalogReviewWork,
}));

vi.mock("$lib/server/moderation/catalogProductReadinessPassport.server", () => ({
	readCatalogProductReadinessPassport: mocks.readCatalogProductReadinessPassport,
}));

import { loadCatalogDataOperationsWorkspace } from "$lib/server/moderation/catalogDataOperationsWorkspace.server";
import { loadCatalogReviewWorkWorkspace } from "$lib/server/moderation/catalogReviewWorkWorkspace.server";
import { loadCatalogProductReadinessPassportWorkspace } from "$lib/server/moderation/catalogProductReadinessPassportWorkspace.server";

describe("catalog privileged workspaces", () => {
	beforeEach(() => vi.clearAllMocks());

	it("requires data-operations permission before loading operational health", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({
			user: { id: "developer-id" },
			role: "developer",
			permissions: ["data_operations.catalog_health.read"],
		});
		mocks.readCatalogDataOperationsHealth.mockResolvedValue(catalogDataOperationsHealthFixture);
		mocks.readCatalogMonitorModerationSummary.mockResolvedValue(catalogMonitorModerationFixture);
		const supabase = {};

		await expect(loadCatalogDataOperationsWorkspace({ locals: { supabase } } as never))
			.resolves.toEqual({
				viewerRole: "developer",
				dashboard: catalogDataOperationsHealthFixture,
				catalogMonitor: catalogMonitorModerationFixture,
			});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			expect.anything(),
			"data_operations.catalog_health.read",
			"/profile/privileged-tools/data-operations",
		);
		expect(mocks.readCatalogDataOperationsHealth).toHaveBeenCalledWith(supabase);
		expect(mocks.readCatalogMonitorModerationSummary).toHaveBeenCalledWith(supabase);
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

		await expect(loadCatalogReviewWorkWorkspace({ locals: { supabase } } as never))
			.resolves.toEqual({ viewerRole: "moderator", reviewWork });
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
		expect(mocks.readCatalogDataOperationsHealth).not.toHaveBeenCalled();
		expect(mocks.readCatalogMonitorModerationSummary).not.toHaveBeenCalled();
		expect(mocks.readCatalogReviewWork).not.toHaveBeenCalled();
	});

	it("uses the caller's exact permission and return route for product passports", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({ role: "developer" });
		mocks.readCatalogProductReadinessPassport.mockResolvedValue({ product: { id: "product-id" } });
		const supabase = {};

		await expect(loadCatalogProductReadinessPassportWorkspace(
			{ locals: { supabase }, params: { productId: "product-id" } } as never,
			"data_operations.catalog_health.read",
			"/profile/privileged-tools/data-operations",
		)).resolves.toEqual({
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
	});
});
