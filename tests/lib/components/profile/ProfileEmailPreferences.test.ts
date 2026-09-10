import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfileEmailPreferences from "$lib/components/profile/ProfileEmailPreferences/ProfileEmailPreferences.svelte";
import type { MarketingEmailPreference } from "$lib/utils/email/marketingEmailPreferences";

const preferences: MarketingEmailPreference[] = [
	{
		topicKey: "product_and_launch_updates",
		label: "Product and launch updates",
		description: "Major product news.",
		isSubscribed: true,
		updatedAt: null,
	},
	{
		topicKey: "mvp_testing_invitations",
		label: "MVP testing invitations",
		description: "Occasional testing invitations.",
		isSubscribed: false,
		updatedAt: null,
	},
	{
		topicKey: "tips_recipes_and_education",
		label: "Tips, recipes, and education",
		description: "Future optional ideas.",
		isSubscribed: false,
		updatedAt: null,
	},
];

describe("ProfileEmailPreferences", () => {
	it("edits every optional category independently", async () => {
		const { container } = render(ProfileEmailPreferences, {
			props: { preferences },
		});

		const testingInvitations = screen.getByRole("switch", {
			name: "MVP testing invitations",
		});
		expect(testingInvitations).not.toBeChecked();
		await fireEvent.click(testingInvitations);
		expect(testingInvitations).toBeChecked();

		const formData = new FormData(container.querySelector("form") ?? undefined);
		expect(formData.get("product_and_launch_updates")).toBe("true");
		expect(formData.get("mvp_testing_invitations")).toBe("true");
		expect(formData.get("tips_recipes_and_education")).toBe("false");
	});

	it("turns every promotional category off without affecting service mail", async () => {
		render(ProfileEmailPreferences, { props: { preferences } });
		await fireEvent.click(
			screen.getByRole("button", {
				name: "Turn off all promotional email",
			}),
		);

		for (const preference of preferences) {
			expect(
				screen.getByRole("switch", { name: preference.label }),
			).not.toBeChecked();
		}
		expect(
			screen.getByText(/account confirmation, password, security/i),
		).toBeVisible();
	});
});
