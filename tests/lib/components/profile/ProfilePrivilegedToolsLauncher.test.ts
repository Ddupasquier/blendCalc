import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfilePrivilegedToolsLauncher from "$lib/components/profile/ProfilePrivilegedToolsLauncher/ProfilePrivilegedToolsLauncher.svelte";
import type { ProfilePrivilegedToolAccess } from "$lib/utils/moderation/profilePrivilegedTools";

const createAccess = (
	totalActionableItems: number | null,
	overrides: Partial<ProfilePrivilegedToolAccess["reviewSummary"]> = {},
): ProfilePrivilegedToolAccess => ({
	role: "admin",
	permissions: [
		"moderation.access",
		"moderation.accounts.manage",
		"moderation.catalog.review",
		"moderation.warnings.review",
		"data_operations.catalog_health.read",
	],
	reviewSummary: {
		pendingProductSubmissions: 0,
		pendingCatalogReviewItems: 0,
		pendingFoodWarningReports: 0,
		pendingProfileImageReviews: 0,
		pendingCatalogDataOperations: 0,
		totalActionableItems,
		unavailable: false,
		identityVerificationRequired: false,
		...overrides,
	},
});

describe("Profile privileged tools launcher", () => {
	it("shows the aggregate of every genuine actionable queue", async () => {
		const onOpen = vi.fn();
		render(ProfilePrivilegedToolsLauncher, {
			props: { access: createAccess(12), onOpen },
		});

		expect(
			screen.getByText("6 tools available · 12 actions waiting"),
		).toBeVisible();
		expect(
			screen.getByLabelText("12 privileged actions requiring attention"),
		).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: /Admin tools/ }));
		expect(onOpen).toHaveBeenCalledOnce();
	});

	it("does not invent a zero while counts are unavailable", () => {
		render(ProfilePrivilegedToolsLauncher, {
			props: {
				access: createAccess(null, { unavailable: true }),
				onOpen: vi.fn(),
			},
		});

		expect(
			screen.getByText("6 tools available · action counts unavailable"),
		).toBeVisible();
		expect(
			screen.queryByLabelText(/privileged actions requiring attention/),
		).not.toBeInTheDocument();
	});
});
