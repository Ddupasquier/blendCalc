import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfilePlayfulMessageSettings from "$lib/components/profile/ProfilePlayfulMessageSettings/ProfilePlayfulMessageSettings.svelte";

describe("ProfilePlayfulMessageSettings", () => {
	it("submits the exact enabled state after the switch changes", async () => {
		const { container } = render(ProfilePlayfulMessageSettings, {
			props: { initiallyEnabled: false },
		});

		const preference = screen.getByRole("switch", {
			name: "Allow playful messages",
		});
		expect(preference).not.toBeChecked();
		await fireEvent.click(preference);
		expect(preference).toBeChecked();
		expect(screen.getByText("On", { exact: true })).toBeVisible();
		expect(
			new FormData(container.querySelector("form") ?? undefined).get(
				"playfulMessagesEnabled",
			),
		).toBe("true");
	});

	it("explains the safety exclusions beside the setting", () => {
		render(ProfilePlayfulMessageSettings, {
			props: { initiallyEnabled: true },
		});

		expect(screen.getByText(/never appears in warnings, recalls/i)).toBeVisible();
		expect(screen.getByRole("switch", {
			name: "Allow playful messages",
		})).toBeChecked();
	});
});
