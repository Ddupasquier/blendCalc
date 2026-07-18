import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import AppHeader from "$lib/components/app/AppHeader.svelte";

describe("AppHeader", () => {
	it("uses shared circular frames for the profile and moderator crown", () => {
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
		expect(profileLink.querySelector(".privileged-action-badge")).toBeInTheDocument();
		expect(
			profileLink.querySelectorAll(".centered-icon").length,
		).toBeGreaterThanOrEqual(2);
	});
});
