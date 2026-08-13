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

	it("can preserve its accessible name without repeating a sheet title visibly", () => {
		render(ThemePreferenceControl, {
			props: {
				value: "system",
				visuallyHideLegend: true,
				onSelect: vi.fn(),
			},
		});

		expect(
			screen.getByRole("group", { name: "Color theme" }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Color theme", { selector: "legend.sr-only" }),
		).toBeInTheDocument();
	});
});
