import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AccountAccessReviewList from "$lib/components/moderation/AccountAccessReviewList/AccountAccessReviewList.svelte";

const accountUser = {
	id: "user-1",
	displayName: "Test User",
	email: "test-user@blendcalc.local",
	createdAt: "2026-08-01T10:00:00.000Z",
	role: null,
	status: "active",
	publicReason: null,
	avatarModerationStatus: "self_attested",
	avatarUrl: "https://example.test/profile.webp",
	moderatorRejectedSubmissionCount: 0,
	catalogSharingSuspendedUntil: null,
};

const renderAccountAccess = () => render(AccountAccessReviewList, {
	props: {
		users: [accountUser],
		query: "",
		totalCount: 1,
		viewerUserId: "moderator-1",
		viewerRole: "moderator",
		searchPath: "/profile/moderator-actions/account-access",
		showHeading: false,
	},
});

describe("AccountAccessReviewList", () => {
	it("keeps account evidence and destructive controls closed until requested", async () => {
		renderAccountAccess();

		expect(screen.getByText("Test User")).toBeVisible();
		expect(screen.getByText("Active")).toBeVisible();
		expect(screen.getByText("test-user@blendcalc.local")).not.toBeVisible();
		expect(screen.getByLabelText("Reason")).not.toBeVisible();

		await fireEvent.click(screen.getByText("Test User"));

		expect(screen.getByText("test-user@blendcalc.local")).toBeVisible();
		expect(screen.getByText("Published")).toBeVisible();
		expect(screen.getByText("0")).toBeVisible();
		expect(screen.getByLabelText("Reason")).not.toBeVisible();

		await fireEvent.click(screen.getByText("Access controls"));

		expect(screen.getByLabelText("Reason")).toBeVisible();
		expect(screen.getByRole("button", { name: "Block account" })).toBeVisible();
	});

	it("explains an empty account search without rendering account controls", () => {
		render(AccountAccessReviewList, {
			props: {
				users: [],
				query: "missing account",
				totalCount: 8,
				viewerUserId: "moderator-1",
				viewerRole: "moderator",
				searchPath: "/profile/moderator-actions/account-access",
			},
		});

		expect(screen.getByText("0 of 8 accounts shown")).toBeVisible();
		expect(screen.getByText("No accounts found")).toBeVisible();
		expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
	});
});
