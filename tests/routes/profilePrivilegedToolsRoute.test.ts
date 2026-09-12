import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogDataOperationsHealthFixture } from "../fixtures/catalogDataOperationsHealth";
import { catalogMonitorModerationFixture } from "../fixtures/catalogMonitorModeration";

const mocks = vi.hoisted(() => ({
	requireModeratorPermission: vi.fn(),
	readPrivilegedToolReviewSummary: vi.fn(),
	getUnavailablePrivilegedToolReviewSummary: vi.fn(),
	readCatalogDataOperationsHealth: vi.fn(),
	readCatalogMonitorModerationSummary: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorPermission: mocks.requireModeratorPermission,
}));

vi.mock("$lib/server/moderation/privilegedToolReviewSummary.server", () => ({
	readPrivilegedToolReviewSummary: mocks.readPrivilegedToolReviewSummary,
	getUnavailablePrivilegedToolReviewSummary:
		mocks.getUnavailablePrivilegedToolReviewSummary,
}));

vi.mock("$lib/server/moderation/catalogDataOperations.server", () => ({
	readCatalogDataOperationsHealth: mocks.readCatalogDataOperationsHealth,
	readCatalogMonitorModerationSummary:
		mocks.readCatalogMonitorModerationSummary,
}));

import { load } from "../../src/routes/profile/privileged-tools/+page.server";

describe("Profile privileged tools route", () => {
	const reviewSummary = {
		pendingProductSubmissions: 2,
		pendingCatalogReviewItems: 1,
		pendingFoodWarningReports: 0,
		pendingFoodWarningFollowUps: 0,
		pendingProfileImageReviews: 0,
		pendingCatalogDataOperations: 3,
		catalogDataOperationSubjects: [],
		catalogDataOperationSubjectsTruncated: false,
		totalActionableItems: 6,
		unavailable: false,
		identityVerificationRequired: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readPrivilegedToolReviewSummary.mockResolvedValue(reviewSummary);
		mocks.getUnavailablePrivilegedToolReviewSummary.mockReturnValue({
			...reviewSummary,
			unavailable: true,
		});
	});

	it("loads the role-aware landing dashboard without catalog diagnostics for moderators", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
			permissions: ["moderation.access"],
		});
		const locals = { supabase: {} };

		await expect(load({ locals } as never)).resolves.toEqual({
			access: {
				role: "moderator",
				permissions: ["moderation.access"],
				reviewSummary,
			},
			diagnostics: null,
			diagnosticsUnavailable: false,
		});
		expect(mocks.requireModeratorPermission).toHaveBeenCalledWith(
			locals,
			"moderation.access",
			"/profile/privileged-tools",
		);
		expect(mocks.readPrivilegedToolReviewSummary).toHaveBeenCalledWith(
			locals.supabase,
		);
		expect(mocks.readCatalogDataOperationsHealth).not.toHaveBeenCalled();
	});

	it("adds catalog and API diagnostics for data operators", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({
			role: "admin",
			permissions: ["moderation.access", "data_operations.catalog_health.read"],
		});
		mocks.readCatalogDataOperationsHealth.mockResolvedValue(
			catalogDataOperationsHealthFixture,
		);
		mocks.readCatalogMonitorModerationSummary.mockResolvedValue(
			catalogMonitorModerationFixture,
		);
		const supabase = {};

		await expect(
			load({ locals: { supabase } } as never),
		).resolves.toMatchObject({
			diagnostics: {
				dashboard: catalogDataOperationsHealthFixture,
				catalogMonitor: catalogMonitorModerationFixture,
			},
			diagnosticsUnavailable: false,
		});
		expect(mocks.readCatalogDataOperationsHealth).toHaveBeenCalledWith(
			supabase,
		);
		expect(mocks.readCatalogMonitorModerationSummary).toHaveBeenCalledWith(
			supabase,
		);
	});

	it("keeps the workspaces usable when diagnostics fail", async () => {
		mocks.requireModeratorPermission.mockResolvedValue({
			role: "admin",
			permissions: ["moderation.access", "data_operations.catalog_health.read"],
		});
		mocks.readCatalogDataOperationsHealth.mockRejectedValue(
			new Error("offline"),
		);

		await expect(
			load({ locals: { supabase: {} } } as never),
		).resolves.toMatchObject({
			diagnostics: null,
			diagnosticsUnavailable: true,
		});
	});

	it("keeps ordinary accounts out of the privileged landing route", async () => {
		mocks.requireModeratorPermission.mockRejectedValue({ status: 403 });

		await expect(load({ locals: {} } as never)).rejects.toMatchObject({
			status: 403,
		});
	});
});
