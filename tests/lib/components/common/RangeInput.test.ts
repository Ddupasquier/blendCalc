import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RangeInput from "$lib/components/common/forms/RangeInput/RangeInput.svelte";

describe("RangeInput callback contract", () => {
	it("separates live value previews from committed values", async () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		render(RangeInput, {
			props: {
				id: "protein-goal",
				value: 25,
				min: 0,
				max: 50,
				ariaLabel: "Set protein goal",
				onValueChange,
				onValueCommit,
			},
		});

		const slider = screen.getByRole("slider", { name: "Set protein goal" });
		await fireEvent.input(slider, { target: { value: "30" } });
		expect(onValueChange).toHaveBeenLastCalledWith(30, expect.any(Event));
		expect(onValueCommit).not.toHaveBeenCalled();

		await fireEvent.change(slider, { target: { value: "30" } });
		expect(onValueCommit).toHaveBeenLastCalledWith(30, expect.any(Event));
	});
});
