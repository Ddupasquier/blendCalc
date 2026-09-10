import { fireEvent, render, screen } from "@testing-library/svelte";
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

		expect(
			screen.getByRole("heading", { name: "Profile images" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("No reported profile images need review"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Ordinary profile-image uploads are published/),
		).toBeInTheDocument();
	});

	it("groups report evidence around one deliberate keep-or-remove decision", async () => {
		render(ProfileImageReportReviewList, {
			props: {
				reports: [
					{
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
					},
				],
			},
		});

		expect(
			screen.getByRole("img", { name: "Profile owner" }),
		).toBeInTheDocument();
		expect(screen.getByText("2 reports")).toBeInTheDocument();
		expect(screen.getByText("First reported Aug 20, 2026")).toBeInTheDocument();
		expect(screen.getByText("Impersonation")).not.toBeVisible();
		await fireEvent.click(screen.getByText("Report details"));
		expect(screen.getByText("Impersonation")).toBeVisible();
		expect(screen.getByText("Another concern")).toBeVisible();
		expect(
			screen.getByRole("combobox", {
				name: "1. Does this image break the profile-image rules?",
			}),
		).toBeInTheDocument();
		const saveDecision = screen.getByRole("button", { name: "Save decision" });
		expect(saveDecision).toBeDisabled();
		await fireEvent.click(
			screen.getByRole("combobox", {
				name: "1. Does this image break the profile-image rules?",
			}),
		);
		await fireEvent.click(
			screen.getByRole("option", { name: "No — keep the current image" }),
		);
		await fireEvent.input(
			screen.getByRole("textbox", {
				name: "2. What evidence supports this decision?",
			}),
			{
				target: { value: "The reported concern is not visible in the image." },
			},
		);
		expect(saveDecision).toBeEnabled();
		expect(
			screen.getByText(/The image stays visible during review/),
		).toBeInTheDocument();
	});
});
