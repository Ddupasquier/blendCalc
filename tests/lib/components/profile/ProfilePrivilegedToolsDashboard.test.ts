import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfilePrivilegedToolsDashboard from "$lib/components/profile/ProfilePrivilegedToolsDashboard/ProfilePrivilegedToolsDashboard.svelte";
import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";
import { catalogDataOperationsHealthFixture } from "../../../fixtures/catalogDataOperationsHealth";
import { catalogMonitorModerationFixture } from "../../../fixtures/catalogMonitorModeration";

const moderatorPermissions: ProfilePrivilegedToolAccess["permissions"] = [
	"moderation.access",
	"moderation.accounts.manage",
	"moderation.catalog.review",
	"moderation.warnings.review",
];

const createAccess = (
	reviewSummary: Partial<ProfilePrivilegedToolAccess["reviewSummary"]>,
	overrides: Partial<ProfilePrivilegedToolAccess> = {},
): ProfilePrivilegedToolAccess => ({
	role: "moderator",
	permissions: moderatorPermissions,
	reviewSummary: {
		pendingProductSubmissions: 0,
		pendingCatalogReviewItems: 0,
		pendingFoodWarningReports: 0,
		pendingFoodWarningFollowUps: 0,
		pendingProfileImageReviews: 0,
		pendingCatalogDataOperations: 0,
		catalogDataOperationSubjects: [],
		catalogDataOperationSubjectsTruncated: false,
		totalActionableItems: 0,
		unavailable: false,
		identityVerificationRequired: false,
		...reviewSummary,
	},
	...overrides,
});

describe("ProfilePrivilegedToolsDashboard", () => {
	it("shows every permitted workspace once and prioritizes active work", () => {
		render(ProfilePrivilegedToolsDashboard, {
			props: {
				access: createAccess({
					pendingProductSubmissions: 4,
					pendingCatalogReviewItems: 2,
					totalActionableItems: 6,
				}),
				diagnostics: null,
				diagnosticsUnavailable: false,
			},
		});

		expect(screen.getByText("6 actions need attention")).toBeVisible();
		expect(screen.getByText(/Start with catalog review work/)).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Needs attention" }),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: /Product submissions/ }),
		).toHaveAttribute("href", "/profile/privileged-tools/product-submissions");
		expect(
			screen.getByRole("link", { name: /Catalog review work/ }),
		).toHaveAttribute("href", "/profile/privileged-tools/catalog-review-work");
		expect(
			screen.getByRole("link", { name: /Food warning reports/ }),
		).toBeVisible();
		expect(screen.getByRole("link", { name: /Account access/ })).toBeVisible();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("keeps warning follow-up work visible in the aggregate", () => {
		render(ProfilePrivilegedToolsDashboard, {
			props: {
				access: createAccess({
					pendingFoodWarningFollowUps: 2,
					totalActionableItems: 2,
				}),
				diagnostics: null,
				diagnosticsUnavailable: false,
			},
		});

		expect(
			screen.getByRole("link", { name: /Food warning reports/ }),
		).toHaveTextContent("2 follow-ups waiting");
		expect(
			screen.getByLabelText(
				"2 food warning reports and follow-ups requiring review",
			),
		).toBeVisible();
	});

	it("shows catalog and API diagnostics only to data operators", () => {
		render(ProfilePrivilegedToolsDashboard, {
			props: {
				access: createAccess(
					{},
					{
						role: "admin",
						permissions: [
							"moderation.access",
							"data_operations.catalog_health.read",
						],
					},
				),
				diagnostics: {
					dashboard: catalogDataOperationsHealthFixture,
					catalogMonitor: catalogMonitorModerationFixture,
				},
				diagnosticsUnavailable: false,
			},
		});

		expect(
			screen.getByRole("heading", { name: "System diagnostics" }),
		).toBeVisible();
		expect(screen.getByText("Active shared catalog")).toBeVisible();
		expect(screen.getByText("Public blendCalcAPI v1")).toBeVisible();
		expect(screen.getByText("Shared catalog only")).toBeVisible();
		expect(screen.getByText("75%")).toBeVisible();
		expect(
			screen.getByRole("link", { name: /Catalog data operations/ }),
		).toBeVisible();
		expect(
			screen.queryByRole("link", { name: /Product submissions/ }),
		).not.toBeInTheDocument();
	});
});
