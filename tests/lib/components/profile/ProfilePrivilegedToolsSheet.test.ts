import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfilePrivilegedToolsSheet from "$lib/components/profile/ProfilePrivilegedToolsSheet/ProfilePrivilegedToolsSheet.svelte";
import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";

const moderatorPermissions: ProfilePrivilegedToolAccess["permissions"] = [
	"moderation.access",
	"moderation.accounts.manage",
	"moderation.catalog.review",
	"moderation.warnings.review",
	"moderation.data_health.read",
];

const createAccess = (
	reviewSummary: ProfilePrivilegedToolAccess["reviewSummary"],
	overrides: Partial<ProfilePrivilegedToolAccess> = {},
): ProfilePrivilegedToolAccess => ({
	role: "moderator",
	permissions: moderatorPermissions,
	reviewSummary,
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
					pendingFoodWarningReports: 0,
					pendingProfileImageReviews: 0,
					totalPendingReviews: 4,
					unavailable: false,
					identityVerificationRequired: false,
				}),
				onClose,
				onNavigate,
			},
		});

		expect(screen.getByRole("button", { name: /Product submissions/ }))
			.toBeEnabled();
		expect(screen.getByRole("button", { name: /Food warning reports/ }))
			.toBeDisabled();
		expect(screen.getByRole("button", { name: /Profile images/ }))
			.toBeDisabled();
		expect(screen.getByRole("button", { name: /Account access/ }))
			.toBeEnabled();
		expect(screen.getByRole("button", { name: /Catalog data health/ }))
			.toBeEnabled();
		expect(screen.getByLabelText("4 product submissions requiring review"))
			.toBeVisible();
		expect(
			screen.getAllByRole("heading", { name: "Moderator tools" }),
		).toHaveLength(1);
		expect(
			screen.getByRole("region", { name: "Moderator tools" }),
		).toBeInTheDocument();
		expect(container.querySelectorAll(".privileged-action-badge")).toHaveLength(1);
		expect(
			container.querySelector(".bottom-sheet__title-accessory .privileged-action-badge"),
		).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: /Product submissions/ }));
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
					pendingFoodWarningReports: null,
					pendingProfileImageReviews: null,
					totalPendingReviews: null,
					unavailable: false,
					identityVerificationRequired: true,
				}),
				onClose,
				onNavigate,
			},
		});

		for (const actionName of [
			"Product submissions",
			"Food warning reports",
			"Profile images",
		]) {
			expect(screen.getByRole("button", { name: new RegExp(actionName) }))
				.toBeEnabled();
		}
		expect(screen.getAllByText("Verify your identity to check this queue"))
			.toHaveLength(3);
		expect(screen.queryByLabelText(/requiring review/)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: /Product submissions/ }));
		expect(onClose).toHaveBeenCalledOnce();
		expect(onNavigate).toHaveBeenCalledWith(
			"/profile/privileged-tools/product-submissions",
		);
	});

	it("keeps review queues disabled when their counts cannot be read", () => {
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingProductSubmissions: null,
					pendingFoodWarningReports: null,
					pendingProfileImageReviews: null,
					totalPendingReviews: null,
					unavailable: true,
					identityVerificationRequired: false,
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
			expect(screen.getByRole("button", { name: new RegExp(actionName) }))
				.toBeDisabled();
		}
		expect(screen.getByRole("button", { name: /Account access/ }))
			.toBeEnabled();
		expect(screen.getByRole("button", { name: /Catalog data health/ }))
			.toBeEnabled();
	});

	it("routes every moderator responsibility to its focused Profile view", async () => {
		const onNavigate = vi.fn();
		render(ProfilePrivilegedToolsSheet, {
			props: {
				open: true,
				access: createAccess({
					pendingProductSubmissions: 1,
					pendingFoodWarningReports: 1,
					pendingProfileImageReviews: 1,
					totalPendingReviews: 3,
					unavailable: false,
					identityVerificationRequired: false,
				}),
				onClose: vi.fn(),
				onNavigate,
			},
		});

		const destinations = [
			["Product submissions", "/profile/privileged-tools/product-submissions"],
			["Food warning reports", "/profile/privileged-tools/food-warning-reports"],
			["Profile images", "/profile/privileged-tools/profile-images"],
			["Account access", "/profile/privileged-tools/account-access"],
			["Catalog data health", "/profile/privileged-tools/catalog-data-health"],
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
				access: createAccess({
					pendingProductSubmissions: 0,
					pendingFoodWarningReports: 0,
					pendingProfileImageReviews: 0,
					totalPendingReviews: 0,
					unavailable: false,
					identityVerificationRequired: false,
				}, {
					role: "admin",
					permissions: ["moderation.access", "moderation.data_health.read"],
				}),
				onClose: vi.fn(),
				onNavigate: vi.fn(),
			},
		});

		expect(screen.getByRole("heading", { name: "Admin tools" })).toBeVisible();
		expect(screen.getByRole("button", { name: /Catalog data health/ })).toBeEnabled();
		expect(screen.queryByRole("button", { name: /Account access/ })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Product submissions/ })).not.toBeInTheDocument();
	});
});
