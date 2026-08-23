import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfileDetailsSettings from "$lib/components/profile/ProfileDetailsSettings/ProfileDetailsSettings.svelte";

describe("ProfileDetailsSettings", () => {
	it("shows and enforces the 25-character preferred-name limit", () => {
		render(ProfileDetailsSettings, {
			props: {
				displayName: "Dylan",
				bio: "",
			},
		});

		const preferredName = screen.getByRole("textbox", {
			name: "Preferred name",
		});
		expect(preferredName).toHaveAttribute("maxlength", "25");
		expect(screen.getByText("5 / 25")).toBeVisible();
		expect(preferredName).toHaveAccessibleDescription(
			/This name stays separate from your private account email\. 20 characters remaining/,
		);
	});
});
