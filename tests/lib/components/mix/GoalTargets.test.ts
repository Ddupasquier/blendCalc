import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import GoalTargets from "$lib/components/mix/controls/GoalTargets/GoalTargets.svelte";

describe("GoalTargets", () => {
	it("uses a synchronized slider and number input for each nutrient goal", async () => {
		const onPreviewGoal = vi.fn();
		const onUpdateGoal = vi.fn();
		render(GoalTargets, {
			props: {
				selectedNutrients: [{ id: 1008, label: "Calories", unit: "kcal" }],
				nutrientGoals: { 1008: 350 },
				selectedGoalTemplateId: "",
				onTemplateChange: vi.fn(),
				onApplyTemplate: vi.fn(),
				onPreviewGoal,
				onUpdateGoal,
				onAddNutrient: vi.fn(),
				onRemoveNutrient: vi.fn(),
				getGoal: () => 350,
				getTotal: () => 555.9,
				open: true,
				onOpenChange: vi.fn(),
			},
		});

		const slider = screen.getByRole("slider", { name: "Set Calories goal" });
		expect(slider).toHaveValue("350");
		expect(slider).toHaveAttribute("max", "700");
		expect(slider).toHaveAttribute(
			"aria-valuetext",
			"350kcal goal; 555.9kcal current",
		);
		expect(screen.getByRole("spinbutton", { name: /Goal for Calories/ })).toHaveValue(350);

		await fireEvent.input(slider, { target: { value: "425" } });
		expect(onPreviewGoal).toHaveBeenLastCalledWith(1008, "425");
		expect(onUpdateGoal).not.toHaveBeenCalled();

		await fireEvent.change(slider, { target: { value: "425" } });
		expect(onUpdateGoal).toHaveBeenLastCalledWith(1008, "425");
	});
});
