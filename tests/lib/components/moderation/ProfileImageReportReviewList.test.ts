import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfileImageReportReviewList from "$lib/components/moderation/ProfileImageReportReviewList/ProfileImageReportReviewList.svelte";

describe("ProfileImageReportReviewList", () => {
	it("explains an empty report-driven queue without implying uploads need approval", () => {
		render(ProfileImageReportReviewList, {
		props: {
			reports: [],
			showHeading: true,
		},
	});

		expect(screen.getByRole("heading", { name: "Profile images" }))
			.toBeInTheDocument();
		expect(screen.getByText("No reported profile images need review"))
			.toBeInTheDocument();
		expect(screen.getByText(/Ordinary profile-image uploads are published/))
			.toBeInTheDocument();
	});

	it("groups report evidence around one keep-or-remove decision", () => {
		render(ProfileImageReportReviewList, {
		props: {
			reports: [{
				id: "report-1",
				reportedProfileUserId: "user-1",
				displayName: "Profile Owner",
				avatarUrl: "https://example.test/avatar.webp",
				avatarAltText: "Profile owner",
				createdAt: "2026-08-20T10:00:00.000Z",
				reports: [
					{
						id: "report-1",
						reasonCode: "impersonation",
						details: "This image appears to belong to someone else.",
						createdAt: "2026-08-20T10:00:00.000Z",
					},
					{
						id: "report-2",
						reasonCode: "other",
						details: null,
						createdAt: "2026-08-21T10:00:00.000Z",
					},
				],
			}],
		},
	});

		expect(screen.getByRole("img", { name: "Profile owner" })).toBeInTheDocument();
		expect(screen.getByText("2 reports")).toBeInTheDocument();
		expect(screen.getByText("First reported Aug 20, 2026")).toBeInTheDocument();
		expect(screen.getByText("Impersonation")).toBeInTheDocument();
		expect(screen.getByText("Another concern")).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "Decision" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save decision" })).toBeInTheDocument();
		expect(screen.getByText(/The image stays visible during review/))
			.toBeInTheDocument();
	});
});
