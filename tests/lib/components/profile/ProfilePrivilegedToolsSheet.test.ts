import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfilePrivilegedToolsSheet from "$lib/components/profile/ProfilePrivilegedToolsSheet/ProfilePrivilegedToolsSheet.svelte";
import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";

const moderatorPermissions: ProfilePrivilegedToolAccess["permissions"] = [
	"moderation.access",
	"moderation.accounts.manage",
	"moderation.catalog.review",
	"moderation.warnings.review",
];

const emptyReviewSummary: ProfilePrivilegedToolAccess["reviewSummary"] = {
	pendingProductSubmissions: 0,
	pendingCatalogReviewItems: 0,
	pendingFoodWarningReports: 0,
	pendingFoodWarningFollowUps: 0,
	pendingProfileImageReviews: 0,
	pendingCatalogDataOperations: 0,
	totalActionableItems: 0,
	unavailable: false,
	identityVerificationRequired: false,
};

const createAccess = (
	reviewSummary: Partial<ProfilePrivilegedToolAccess["reviewSummary"]>,
	overrides: Partial<ProfilePrivilegedToolAccess> = {},
): ProfilePrivilegedToolAccess => ({
	role: "moderator",
	permissions: moderatorPermissions,
	reviewSummary: { ...emptyReviewSummary, ...reviewSummary },
	...overrides,
});

describe("Profile privileged tools sheet", () => {
	it("shows permitted moderator tools and disables empty review queues", async () => {
		const onClose = vi.fn();
		const onNavigate = vi.fn();
		const { container } = render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingProductSubmissions: 4,
					pendingCatalogReviewItems: 2,
					pendingFoodWarningReports: 0,
					pendingFoodWarningFollowUps: 0,
					pendingProfileImageReviews: 0,
					totalActionableItems: 6,
				}),
				onClose,
				onNavigate,
			},
		});

		expect(
			screen.getByRole("button", { name: /Product submissions/ }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: /Food warning reports/ }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /Profile images/ }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /Account access/ }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: /Catalog review work/ }),
		).toBeEnabled();
		expect(
			screen.queryByRole("button", { name: /Catalog data operations/ }),
		).not.toBeInTheDocument();
		expect(
			screen.getByLabelText("4 product submissions requiring review"),
		).toBeVisible();
		expect(
			screen.getByLabelText("2 catalog decisions requiring review"),
		).toBeVisible();
		expect(screen.getByText("6 actions need attention")).toBeVisible();
		expect(screen.getByText(/Start with catalog review work/)).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Needs attention" }),
		).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Other review tools" }),
		).toBeVisible();
		expect(
			screen.getAllByRole("heading", { name: "Moderator tools" }),
		).toHaveLength(1);
		expect(
			screen.getByRole("dialog", { name: "Moderator tools" }),
		).toBeInTheDocument();
		expect(container.querySelectorAll(".privileged-action-badge")).toHaveLength(
			1,
		);
		expect(
			container.querySelector(
				".bottom-sheet__title-accessory .privileged-action-badge",
			),
		).toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /Product submissions/ }),
		);
		expect(onClose).toHaveBeenCalledOnce();
		expect(onNavigate).toHaveBeenCalledWith(
			"/profile/privileged-tools/product-submissions",
		);
	});

	it("keeps protected queues available as identity-verification entry points", async () => {
		const onClose = vi.fn();
		const onNavigate = vi.fn();
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingProductSubmissions: null,
					pendingCatalogReviewItems: null,
					pendingFoodWarningReports: null,
					pendingFoodWarningFollowUps: null,
					pendingProfileImageReviews: null,
					pendingCatalogDataOperations: null,
					totalActionableItems: null,
					identityVerificationRequired: true,
				}),
				onClose,
				onNavigate,
			},
		});

		for (const actionName of [
			"Product submissions",
			"Catalog review work",
			"Food warning reports",
			"Profile images",
		]) {
			expect(
				screen.getByRole("button", { name: new RegExp(actionName) }),
			).toBeEnabled();
		}
		expect(
			screen.getAllByText("Verify your identity to check this queue"),
		).toHaveLength(4);
		expect(screen.getByText("Verify once to see today's work")).toBeVisible();
		expect(screen.queryByLabelText(/requiring review/)).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("button", { name: /Product submissions/ }),
		);
		expect(onClose).toHaveBeenCalledOnce();
		expect(onNavigate).toHaveBeenCalledWith(
			"/profile/privileged-tools/product-submissions",
		);
	});

	it("keeps food-warning work visible when only follow-ups remain", () => {
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingFoodWarningReports: 0,
					pendingFoodWarningFollowUps: 2,
					totalActionableItems: 2,
				}),
				onClose: vi.fn(),
				onNavigate: vi.fn(),
			},
		});

		const warningWork = screen.getByRole("button", {
			name: /Food warning reports/,
		});
		expect(warningWork).toBeEnabled();
		expect(warningWork).toHaveTextContent("2 follow-ups waiting");
		expect(
			screen.getByLabelText(
				"2 food warning reports and follow-ups requiring review",
			),
		).toBeVisible();
		expect(screen.getByText(/Start with food warning reports/)).toBeVisible();
	});

	it("keeps review queues disabled when their counts cannot be read", () => {
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingProductSubmissions: null,
					pendingCatalogReviewItems: null,
					pendingFoodWarningReports: null,
					pendingFoodWarningFollowUps: null,
					pendingProfileImageReviews: null,
					pendingCatalogDataOperations: null,
					totalActionableItems: null,
					unavailable: true,
				}),
				onClose: vi.fn(),
				onNavigate: vi.fn(),
			},
		});

		for (const actionName of [
			"Product submissions",
			"Food warning reports",
			"Profile images",
		]) {
			expect(
				screen.getByRole("button", { name: new RegExp(actionName) }),
			).toBeDisabled();
		}
		expect(
			screen.getByRole("button", { name: /Account access/ }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: /Catalog review work/ }),
		).toBeEnabled();
		expect(
			screen.getByText("Queue status is temporarily unavailable"),
		).toBeVisible();
	});

	it("routes every moderator responsibility to its focused Profile view", async () => {
		const onNavigate = vi.fn();
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingProductSubmissions: 1,
					pendingCatalogReviewItems: 2,
					pendingFoodWarningReports: 1,
					pendingProfileImageReviews: 1,
					totalActionableItems: 5,
				}),
				onClose: vi.fn(),
				onNavigate,
			},
		});

		const destinations = [
			["Product submissions", "/profile/privileged-tools/product-submissions"],
			[
				"Food warning reports",
				"/profile/privileged-tools/food-warning-reports",
			],
			["Profile images", "/profile/privileged-tools/profile-images"],
			["Account access", "/profile/privileged-tools/account-access"],
			["Catalog review work", "/profile/privileged-tools/catalog-review-work"],
		] as const;

		for (const [label, href] of destinations) {
			await fireEvent.click(
				screen.getByRole("button", { name: new RegExp(label) }),
			);
			expect(onNavigate).toHaveBeenLastCalledWith(href);
		}
	});

	it("uses the verified role title and hides tools without DB permission", () => {
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess(
					{
						pendingCatalogDataOperations: 7,
						totalActionableItems: 7,
					},
					{
						role: "admin",
						permissions: [
							"moderation.access",
							"data_operations.catalog_health.read",
						],
					},
				),
				onClose: vi.fn(),
				onNavigate: vi.fn(),
			},
		});

		expect(screen.getByRole("heading", { name: "Admin tools" })).toBeVisible();
		expect(
			screen.getByRole("button", { name: /Catalog data operations/ }),
		).toBeEnabled();
		expect(
			screen.getByLabelText("7 catalog subjects requiring data operations"),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: /Account access/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Product submissions/ }),
		).not.toBeInTheDocument();
	});
});
