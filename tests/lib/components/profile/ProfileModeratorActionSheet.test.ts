import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileModeratorActionSheet from "$lib/components/profile/ProfileModeratorActionSheet/ProfileModeratorActionSheet.svelte";

describe("Profile moderator action sheet", () => {
	it("shows every moderator option and disables empty review queues", async () => {
		const onClose = vi.fn();
		const onNavigate = vi.fn();
		render(ProfileModeratorActionSheet, {
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

		await fireEvent.click(screen.getByRole("button", { name: /Product submissions/ }));
		expect(onClose).toHaveBeenCalledOnce();
		expect(onNavigate).toHaveBeenCalledWith("/moderation#product-review");
	});
});
