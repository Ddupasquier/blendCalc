import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import PrivilegedWorkspaceGuide from "$lib/components/moderation/PrivilegedWorkspaceGuide/PrivilegedWorkspaceGuide.svelte";

describe("PrivilegedWorkspaceGuide", () => {
	it("makes waiting work and its completion condition explicit", () => {
		render(PrivilegedWorkspaceGuide, {
			props: {
				tone: "attention",
				title: "Review 2 warning reports",
				description: "Start with the oldest report.",
				completion: "Every report has an evidence-backed outcome.",
				count: 2,
				countLabel: "warning reports requiring review",
			},
		});

		expect(screen.getByText("Start here")).toBeVisible();
		expect(screen.getByText("Review 2 warning reports")).toBeVisible();
		expect(
			screen.getByLabelText("2 warning reports requiring review"),
		).toBeVisible();
		expect(screen.getByText("Done when")).toBeVisible();
		expect(
			screen.getByText("Every report has an evidence-backed outcome."),
		).toBeVisible();
	});

	it("distinguishes an on-demand lookup tool from a queue", () => {
		render(PrivilegedWorkspaceGuide, {
			props: {
				tone: "lookup",
				title: "Search for the exact account first",
				description: "Use a name, email, user ID, role, or status.",
				completion: "The account standing is confirmed.",
			},
		});

		expect(screen.getByText("Use when needed")).toBeVisible();
		expect(screen.getByText("On demand")).toBeVisible();
		expect(screen.queryByLabelText(/requiring/)).not.toBeInTheDocument();
	});
});
