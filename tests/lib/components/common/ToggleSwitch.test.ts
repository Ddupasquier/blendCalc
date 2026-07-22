import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";

describe("ToggleSwitch", () => {
	it("waits for the parent state before changing its checked appearance", async () => {
		const onChange = vi.fn();
		render(ToggleSwitch, {
			props: {
				id: "share-toggle",
				ariaLabel: "Share with community",
				checked: false,
				onChange,
			},
		});

		const toggle = screen.getByRole("switch", { name: "Share with community" });
		await fireEvent.click(toggle);

		expect(onChange).toHaveBeenCalledWith(true);
		expect(toggle).not.toBeChecked();
	});
});
