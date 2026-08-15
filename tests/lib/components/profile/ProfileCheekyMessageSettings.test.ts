import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProfileCheekyMessageSettings from "$lib/components/profile/ProfileCheekyMessageSettings/ProfileCheekyMessageSettings.svelte";

describe("ProfileCheekyMessageSettings", () => {
	it("starts off unless the account explicitly enabled cheeky messages", async () => {
		render(ProfileCheekyMessageSettings, {
			props: { initiallyEnabled: false },
		});

		const preference = screen.getByRole("switch", {
			name: "Allow cheeky messages",
		});
		expect(preference).not.toBeChecked();
		await fireEvent.click(preference);
		expect(preference).toBeChecked();
		expect(screen.getByText("On", { exact: true })).toBeVisible();
	});

	it("explains the safety exclusions beside the setting", () => {
		render(ProfileCheekyMessageSettings, {
			props: { initiallyEnabled: true },
		});

		expect(screen.getByText(/never appears in warnings, recalls/i)).toBeVisible();
		expect(screen.getByRole("switch", {
			name: "Allow cheeky messages",
		})).toBeChecked();
	});
});
