import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ThemePreferenceControl from "$lib/components/profile/ThemePreferenceControl/ThemePreferenceControl.svelte";

describe("ThemePreferenceControl", () => {
	it("disables every choice while the preference is saving", () => {
		render(ThemePreferenceControl, {
			props: {
				value: "light",
				disabled: true,
				onSelect: vi.fn(),
			},
		});

		for (const radio of screen.getAllByRole("radio")) {
			expect(radio).toBeDisabled();
		}
	});
});
