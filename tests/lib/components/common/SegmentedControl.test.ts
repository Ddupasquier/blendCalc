import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "$lib/components/common/buttons/SegmentedControl.svelte";

describe("SegmentedControl", () => {
	it("uses roving focus and arrow-key tab navigation", async () => {
		const onSelect = vi.fn();
		render(SegmentedControl, {
			props: {
				label: "Saved ingredient lists",
				value: "fridge",
				options: [
					{
						value: "fridge",
						label: "Fridge",
						id: "fridge-tab",
						controlsId: "ingredients-panel",
					},
					{
						value: "shopping",
						label: "Shopping List",
						id: "shopping-tab",
						controlsId: "ingredients-panel",
					},
				],
				onSelect,
			},
		});

		const [fridgeTab, shoppingTab] = screen.getAllByRole("tab");
		expect(fridgeTab).toHaveAttribute("tabindex", "0");
		expect(shoppingTab).toHaveAttribute("tabindex", "-1");
		expect(fridgeTab).toHaveAttribute("aria-controls", "ingredients-panel");

		fridgeTab.focus();
		await fireEvent.keyDown(fridgeTab, { key: "ArrowRight" });
		expect(onSelect).toHaveBeenCalledWith("shopping");
		expect(shoppingTab).toHaveFocus();
	});
});
