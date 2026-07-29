import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ThemePreferenceControl from "$lib/components/profile/ThemePreferenceControl/ThemePreferenceControl.svelte";

describe("ThemePreferenceControl", () => {
	it("uses native radios for device, light, and dark choices", () => {
		render(ThemePreferenceControl, {
			props: {
				value: "system",
				onSelect: vi.fn(),
			},
		});

		expect(screen.getByRole("group", { name: "Color theme" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /Device/ })).toBeChecked();
		expect(screen.getByRole("radio", { name: /Light/ })).not.toBeChecked();
		expect(screen.getByRole("radio", { name: /Dark/ })).not.toBeChecked();
	});

	it("reports a selected theme through one reusable callback", async () => {
		const onSelect = vi.fn();
		render(ThemePreferenceControl, {
			props: {
				value: "system",
				onSelect,
			},
		});

		await fireEvent.click(screen.getByRole("radio", { name: /Dark/ }));
		expect(onSelect).toHaveBeenCalledWith("dark");
	});

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
