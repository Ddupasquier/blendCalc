import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CheckboxGroup from "$lib/components/common/forms/CheckboxGroup/CheckboxGroup.svelte";

describe("CheckboxGroup", () => {
	it("submits a shared field name and reports the next selected values", async () => {
		const onChange = vi.fn();
		render(CheckboxGroup, {
			props: {
				id: "priority-nutrient",
				name: "prioritizedNutrientIds",
				options: [
					{ id: 1, label: "Protein" },
					{ id: 2, label: "Fiber" },
				],
				selected: [1],
				onChange,
			},
		});

		const fiber = screen.getByRole("checkbox", { name: "Fiber" });
		expect(fiber).toHaveAttribute("name", "prioritizedNutrientIds");
		await fireEvent.click(fiber);
		expect(onChange).toHaveBeenCalledWith([1, 2]);
	});
});
