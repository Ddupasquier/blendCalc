import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogDataOperationsHealthFixture } from "../fixtures/catalogDataOperationsHealth";
import { catalogMonitorModerationFixture } from "../fixtures/catalogMonitorModeration";

const mocks = vi.hoisted(() => ({
	parent: vi.fn(),
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

const loadRoute = (event: Record<string, unknown>) =>
	load({ parent: mocks.parent, ...event } as never);

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
		mocks.parent.mockResolvedValue({});
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

		await expect(loadRoute({ locals })).resolves.toEqual({
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
			user: { id: "admin-id" },
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

		await expect(loadRoute({ locals: { supabase } })).resolves.toMatchObject({
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
			user: { id: "admin-id" },
			role: "admin",
			permissions: ["moderation.access", "data_operations.catalog_health.read"],
		});
		mocks.readCatalogDataOperationsHealth.mockRejectedValue(
			new Error("offline"),
		);

		await expect(
			loadRoute({ locals: { supabase: {} } }),
		).resolves.toMatchObject({
			diagnostics: null,
			diagnosticsUnavailable: true,
		});
	});

	it("keeps ordinary accounts out of the privileged landing route", async () => {
		mocks.requireModeratorPermission.mockRejectedValue({ status: 403 });

		await expect(loadRoute({ locals: {} })).rejects.toMatchObject({
			status: 403,
		});
		expect(mocks.parent).not.toHaveBeenCalled();
		expect(mocks.readPrivilegedToolReviewSummary).not.toHaveBeenCalled();
	});

	const inheritedSnapshot = () => ({
		authUser: { id: "moderator-id" },
		privilegedToolAccess: {
			role: "moderator",
			permissions: ["moderation.access"],
			reviewSummary,
		},
	});
	const permitModerator = () =>
		mocks.requireModeratorPermission.mockResolvedValue({
			user: { id: "moderator-id" },
			role: "moderator",
			permissions: ["moderation.access"],
		});

	it("reuses the matching request snapshot without repeating summary/admission work", async () => {
		permitModerator();
		mocks.parent.mockResolvedValue(inheritedSnapshot());
		const result = await loadRoute({ locals: { supabase: {} } });
		expect(result).toMatchObject({ access: { reviewSummary } });
		expect(mocks.requireModeratorPermission).toHaveBeenCalledOnce();
		expect(mocks.parent).toHaveBeenCalledOnce();
		expect(mocks.readPrivilegedToolReviewSummary).not.toHaveBeenCalled();
	});

	for (const mismatch of [
		"identity",
		"role",
		"permissions",
		"assurance",
	] as const) {
		it(`reads an authorized fresh summary when the parent ${mismatch} differs`, async () => {
			permitModerator();
			const inherited = inheritedSnapshot();
			if (mismatch === "identity") inherited.authUser.id = "other-user";
			if (mismatch === "role") inherited.privilegedToolAccess.role = "admin";
			if (mismatch === "permissions")
				inherited.privilegedToolAccess.permissions = [];
			if (mismatch === "assurance")
				inherited.privilegedToolAccess.reviewSummary = {
					...reviewSummary,
					identityVerificationRequired: true,
				};
			mocks.parent.mockResolvedValue(inherited);
			await expect(
				loadRoute({ locals: { supabase: {} } }),
			).resolves.toMatchObject({
				access: { reviewSummary },
			});
			expect(mocks.readPrivilegedToolReviewSummary).toHaveBeenCalledOnce();
		});
	}

	it("preserves the unavailable parent state without reporting zero work or retrying", async () => {
		permitModerator();
		const unavailable = {
			...reviewSummary,
			unavailable: true,
			totalActionableItems: null,
		};
		mocks.parent.mockResolvedValue({
			...inheritedSnapshot(),
			privilegedToolAccess: {
				...inheritedSnapshot().privilegedToolAccess,
				reviewSummary: unavailable,
			},
		});
		await expect(
			loadRoute({ locals: { supabase: {} } }),
		).resolves.toMatchObject({
			access: { reviewSummary: unavailable },
		});
		expect(mocks.readPrivilegedToolReviewSummary).not.toHaveBeenCalled();
	});

	it("enforces MFA before considering a matching privileged parent snapshot", async () => {
		mocks.parent.mockResolvedValue(inheritedSnapshot());
		mocks.requireModeratorPermission.mockRejectedValue({
			status: 303,
			location: "/auth/mfa/challenge",
		});
		await expect(loadRoute({ locals: {} })).rejects.toMatchObject({
			status: 303,
		});
		expect(mocks.parent).not.toHaveBeenCalled();
		expect(mocks.readPrivilegedToolReviewSummary).not.toHaveBeenCalled();
	});
});
