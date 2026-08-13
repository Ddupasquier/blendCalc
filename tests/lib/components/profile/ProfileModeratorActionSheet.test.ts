import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileModeratorActionSheet from "$lib/components/profile/ProfileModeratorActionSheet/ProfileModeratorActionSheet.svelte";

describe("Profile moderator action sheet", () => {
	it("shows every moderator option and disables empty review queues", async () => {
		const onClose = vi.fn();
		const onNavigate = vi.fn();
		const { container } = render(ProfileModeratorActionSheet, {
			props: {
				open: true,
				summary: {
					pendingProductSubmissions: 4,
					pendingFoodWarningReports: 0,
					pendingProfileImageReviews: 0,
					totalPendingReviews: 4,
					unavailable: false,
					identityVerificationRequired: false,
				},
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
			screen.getAllByRole("heading", { name: "Moderator actions" }),
		).toHaveLength(1);
		expect(
			screen.getByRole("region", { name: "Moderator actions" }),
		).toBeInTheDocument();
		expect(container.querySelectorAll(".privileged-action-badge")).toHaveLength(1);
		expect(
			container.querySelector(".bottom-sheet__title-accessory .privileged-action-badge"),
		).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: /Product submissions/ }));
		expect(onClose).toHaveBeenCalledOnce();
		expect(onNavigate).toHaveBeenCalledWith("/moderation#product-review");
	});

	it("keeps protected queues available as identity-verification entry points", async () => {
		const onClose = vi.fn();
		const onNavigate = vi.fn();
		render(ProfileModeratorActionSheet, {
			props: {
				open: true,
				summary: {
					pendingProductSubmissions: null,
					pendingFoodWarningReports: null,
					pendingProfileImageReviews: null,
					totalPendingReviews: null,
					unavailable: false,
					identityVerificationRequired: true,
				},
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
		expect(onNavigate).toHaveBeenCalledWith("/moderation#product-review");
	});

	it("keeps review queues disabled when their counts cannot be read", () => {
		render(ProfileModeratorActionSheet, {
			props: {
				open: true,
				summary: {
					pendingProductSubmissions: null,
					pendingFoodWarningReports: null,
					pendingProfileImageReviews: null,
					totalPendingReviews: null,
					unavailable: true,
					identityVerificationRequired: false,
				},
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
});
