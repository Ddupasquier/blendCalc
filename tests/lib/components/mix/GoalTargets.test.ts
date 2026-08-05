import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import GoalTargets from "$lib/components/mix/controls/GoalTargets/GoalTargets.svelte";

const calorieGoal = {
  nutrientId: 1008,
  goalType: "exact" as const,
  targetAmount: 350,
  upperAmount: null,
  toleranceRatio: 0.1,
  importanceWeight: 1,
  sortOrder: 1,
};

describe("GoalTargets", () => {
	it("uses a synchronized slider and number input for each nutrient goal", async () => {
		const onPreviewGoal = vi.fn();
		const onUpdateGoal = vi.fn();
		render(GoalTargets, {
			props: {
				selectedNutrients: [{ id: 1008, label: "Calories", unit: "kcal" }],
        nutrientGoals: { 1008: calorieGoal },
        goalTemplates: [],
				selectedGoalTemplateId: "",
        templateCustomized: false,
        keepExtraGoals: false,
				onTemplateChange: vi.fn(),
        onKeepExtraGoalsChange: vi.fn(),
				onApplyTemplate: vi.fn(),
        onSaveCurrentTemplate: vi.fn(),
        onDeleteTemplate: vi.fn(),
				onPreviewGoal,
				onUpdateGoal,
        onUpdateUpperGoal: vi.fn(),
        onUpdateGoalType: vi.fn(),
				onAddNutrient: vi.fn(),
				onRemoveNutrient: vi.fn(),
        getGoal: () => calorieGoal,
				getTotal: () => 555.9,
				open: true,
				onOpenChange: vi.fn(),
			},
		});

		const slider = screen.getByRole("slider", { name: "Set Calories goal" });
		expect(screen.getByText("Current")).toBeInTheDocument();
		expect(screen.getByText("555.9")).toBeInTheDocument();
		expect(screen.getByText("Goal")).toBeInTheDocument();
		expect(slider).toHaveValue("350");
		expect(slider).toHaveAttribute("max", "700");
		expect(slider).toHaveAttribute(
			"aria-valuetext",
      "=350kcal goal; 555.9kcal current",
		);
    expect(
      screen.getByRole("spinbutton", { name: "Goal value for Calories in kcal" }),
    ).toHaveValue(350);
		expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
		expect(
			screen.getByRole("button", { name: "Stop tracking Calories" }),
		).toBeInTheDocument();

		await fireEvent.input(slider, { target: { value: "425" } });
		expect(onPreviewGoal).toHaveBeenLastCalledWith(1008, "425");
		expect(onUpdateGoal).not.toHaveBeenCalled();

		await fireEvent.change(slider, { target: { value: "425" } });
		expect(onUpdateGoal).toHaveBeenLastCalledWith(1008, "425");
	});

  it("applies, explains, and manages DB-backed personal presets", async () => {
    const onTemplateChange = vi.fn();
    const onApplyTemplate = vi.fn().mockResolvedValue(true);
    const onDeleteTemplate = vi.fn();
    const onUpdateGoalType = vi.fn();
    const personalTemplate = {
      id: "00000000-0000-4000-8000-000000000002",
      selectionId: "user:00000000-0000-4000-8000-000000000002",
      scope: "user" as const,
      versionId: null,
      version: null,
      label: "Weekday lunch",
      description: "Your saved nutrition goals.",
      goalBasis: "per_mix" as const,
      goals: { 1008: calorieGoal },
      sourceKey: null,
      sourceReference: null,
      reviewedAt: null,
      isDefault: false,
    };

    render(GoalTargets, {
      props: {
        selectedNutrients: [{ id: 1008, label: "Calories", unit: "kcal" }],
        nutrientGoals: { 1008: calorieGoal },
        goalTemplates: [personalTemplate],
        selectedGoalTemplateId: personalTemplate.selectionId,
        templateCustomized: true,
        keepExtraGoals: false,
        onTemplateChange,
        onKeepExtraGoalsChange: vi.fn(),
        onApplyTemplate,
        onSaveCurrentTemplate: vi.fn(),
        onDeleteTemplate,
        onPreviewGoal: vi.fn(),
        onUpdateGoal: vi.fn(),
        onUpdateUpperGoal: vi.fn(),
        onUpdateGoalType,
        onAddNutrient: vi.fn(),
        onRemoveNutrient: vi.fn(),
        getGoal: () => calorieGoal,
        getTotal: () => 350,
        open: true,
        onOpenChange: vi.fn(),
      },
    });

		expect(screen.queryByText("Your saved nutrition goals.")).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("combobox", { name: "Goal preset" }));
		await fireEvent.click(
			screen.getByRole("option", { name: "Weekday lunch · Yours" }),
		);
		expect(onTemplateChange).toHaveBeenCalledWith(personalTemplate.selectionId);
		expect(screen.getByText("Your saved nutrition goals.")).toBeInTheDocument();
		expect(screen.getByText("Customized")).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(onApplyTemplate).toHaveBeenCalledOnce();
		expect(screen.queryByText("Your saved nutrition goals.")).not.toBeInTheDocument();

		await fireEvent.click(
			screen.getByRole("combobox", { name: "Goal rule for Calories" }),
		);
		await fireEvent.click(screen.getByRole("option", { name: "At least" }));
    expect(onUpdateGoalType).toHaveBeenCalledWith(1008, "minimum");

		await fireEvent.click(screen.getByRole("combobox", { name: "Goal preset" }));
		await fireEvent.click(
			screen.getByRole("option", { name: "Weekday lunch · Yours" }),
		);
    await fireEvent.click(
      screen.getByRole("button", { name: "Delete preset" }),
    );
		expect(onDeleteTemplate).toHaveBeenCalledWith(personalTemplate.id);
	});

	it("keeps the preset preview available when applying fails", async () => {
		const template = {
			id: "00000000-0000-4000-8000-000000000003",
			selectionId: "system:00000000-0000-4000-8000-000000000003",
			scope: "system" as const,
			versionId: "00000000-0000-4000-8000-000000000003",
			version: 1,
			label: "Balanced",
			description: "Moderate calories, protein, carbs, fiber, and sugar.",
			goalBasis: "per_mix" as const,
			goals: { 1008: calorieGoal },
			sourceKey: null,
			sourceReference: null,
			reviewedAt: null,
			isDefault: true,
		};

		render(GoalTargets, {
			props: {
				selectedNutrients: [{ id: 1008, label: "Calories", unit: "kcal" }],
				nutrientGoals: { 1008: calorieGoal },
				goalTemplates: [template],
				selectedGoalTemplateId: template.selectionId,
				templateCustomized: false,
				keepExtraGoals: false,
				onTemplateChange: vi.fn(),
				onKeepExtraGoalsChange: vi.fn(),
				onApplyTemplate: vi.fn().mockResolvedValue(false),
				onSaveCurrentTemplate: vi.fn(),
				onDeleteTemplate: vi.fn(),
				onPreviewGoal: vi.fn(),
				onUpdateGoal: vi.fn(),
				onUpdateUpperGoal: vi.fn(),
				onUpdateGoalType: vi.fn(),
				onAddNutrient: vi.fn(),
				onRemoveNutrient: vi.fn(),
				getGoal: () => calorieGoal,
				getTotal: () => 350,
				open: true,
				onOpenChange: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByRole("combobox", { name: "Goal preset" }));
		await fireEvent.click(screen.getByRole("option", { name: "Balanced" }));
		expect(screen.getByText(template.description)).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(screen.getByText(template.description)).toBeInTheDocument();
	});
});
