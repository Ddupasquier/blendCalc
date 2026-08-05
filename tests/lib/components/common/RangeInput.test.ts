import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RangeInput from "$lib/components/common/forms/RangeInput/RangeInput.svelte";

describe("RangeInput", () => {
	it("exposes a native range and reports dragged values", async () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		const { container } = render(RangeInput, {
			props: {
				id: "protein-goal",
				value: 25,
				fillValue: 17.5,
				min: 0,
				max: 50,
				step: 0.1,
				tone: "warning",
				ariaLabel: "Set protein goal",
				ariaValueText: "25g goal; 17.5g current",
				onValueChange,
				onValueCommit,
			},
		});

		const slider = screen.getByRole("slider", { name: "Set protein goal" });
		expect(slider).toHaveAttribute("aria-valuetext", "25g goal; 17.5g current");
		expect(slider).toHaveAttribute("max", "50");
		expect(container.querySelector(".range-input__fill")).toHaveStyle("width: 35%");

		await fireEvent.input(slider, { target: { value: "30" } });
		expect(onValueChange).toHaveBeenLastCalledWith(30, expect.any(Event));
		expect(onValueCommit).not.toHaveBeenCalled();

		await fireEvent.change(slider, { target: { value: "30" } });
		expect(onValueCommit).toHaveBeenLastCalledWith(30, expect.any(Event));
	});
});
