import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import AppHeader from "$lib/components/app/AppHeader.svelte";

describe("AppHeader", () => {
	it("uses a circular profile frame and standalone moderator crown", () => {
		render(AppHeader, {
			props: {
				displayName: "QA Moderator",
				role: "moderator",
			},
		});

		const profileLink = screen.getByRole("link", {
			name: "Open profile for QA Moderator",
		});

		expect(profileLink.querySelector(".circular-media-frame")).toBeInTheDocument();
		const crown = profileLink.querySelector(".privileged-action-badge");
		expect(crown).toBeInTheDocument();
		expect(crown).not.toHaveClass("circular-icon-frame");
		expect(crown?.querySelector("svg")).toHaveAttribute("fill", "currentColor");
		expect(
			profileLink.querySelectorAll(".centered-icon").length,
		).toBeGreaterThanOrEqual(2);
	});
});
