import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileNutrientPrioritySettings from "$lib/components/profile/ProfileNutrientPrioritySettings/ProfileNutrientPrioritySettings.svelte";

const options = [
	{
		id: 1003,
		label: "Protein",
		unit: "g",
		nutrientNumber: "203",
		sortOrder: 1,
		highlight: true,
		defaultGoal: 25,
	},
	{
		id: 1079,
		label: "Dietary Fiber",
		unit: "g",
		nutrientNumber: "291",
		sortOrder: 2,
		highlight: true,
		defaultGoal: null,
	},
];

describe("ProfileNutrientPrioritySettings", () => {
	it("shows ordered targets and distinguishes display-only priorities", () => {
		render(ProfileNutrientPrioritySettings, {
			props: {
				options,
				selectedNutrientIds: [1003, 1079],
				disabled: false,
				onSelectionChange: vi.fn(),
			},
		});

		expect(screen.getByText("1. Protein")).toBeInTheDocument();
		expect(screen.getByText("Default Mix target: 25 g")).toBeInTheDocument();
		expect(
			screen.getByText("Display emphasis only · no default target configured"),
		).toBeInTheDocument();
	});

	it("moves and removes priorities without losing their order", async () => {
		const onSelectionChange = vi.fn();
		render(ProfileNutrientPrioritySettings, {
			props: {
				options,
				selectedNutrientIds: [1003, 1079],
				disabled: false,
				onSelectionChange,
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: "Move Protein down" }));
		expect(onSelectionChange).toHaveBeenCalledWith([1079, 1003]);

		await fireEvent.click(screen.getByRole("button", { name: "Remove Protein" }));
		expect(onSelectionChange).toHaveBeenCalledWith([1079]);
	});
});
