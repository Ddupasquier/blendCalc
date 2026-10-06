import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
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
		pendingFoodWarningFollowUps: 0,
		pendingProfileImageReviews: 0,
		pendingCatalogDataOperations: 0,
		totalActionableItems,
		unavailable: false,
		identityVerificationRequired: false,
		...overrides,
		catalogDataOperationSubjects: overrides.catalogDataOperationSubjects ?? [],
		catalogDataOperationSubjectsTruncated:
			overrides.catalogDataOperationSubjectsTruncated ?? false,
	},
});

describe("Profile privileged tools launcher", () => {
	it.each([0, 1, 5, 47, 120])(
		"preserves the exact actionable count %i without a zero badge",
		(count) => {
			render(ProfilePrivilegedToolsLauncher, {
				props: { access: createAccess(count) },
			});
			const description =
				count === 0
					? "6 tools available · no actions waiting"
					: `6 tools available · ${count} ${count === 1 ? "action" : "actions"} waiting`;
			expect(screen.getByText(description)).toBeVisible();
			if (count === 0) {
				expect(
					screen.queryByLabelText(/privileged actions requiring attention/),
				).not.toBeInTheDocument();
			} else {
				expect(
					screen.getByLabelText(
						`${count} privileged actions requiring attention`,
					),
				).toHaveTextContent(count > 99 ? "99+" : String(count));
			}
		},
	);

	it("links the aggregate of every genuine actionable queue to the dashboard", () => {
		render(ProfilePrivilegedToolsLauncher, {
			props: { access: createAccess(12) },
		});

		expect(
			screen.getByText("6 tools available · 12 actions waiting"),
		).toBeVisible();
		expect(
			screen.getByLabelText("12 privileged actions requiring attention"),
		).toBeVisible();

		expect(screen.getByRole("link", { name: /Admin tools/ })).toHaveAttribute(
			"href",
			"/profile/privileged-tools",
		);
	});

	it("does not invent a zero while counts are unavailable", () => {
		render(ProfilePrivilegedToolsLauncher, {
			props: {
				access: createAccess(null, { unavailable: true }),
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
