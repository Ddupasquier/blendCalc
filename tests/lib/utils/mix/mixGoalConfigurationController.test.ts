import { beforeEach, describe, expect, it, vi } from "vitest";

const mixGoalStorage = vi.hoisted(() => ({
	applyCloudMixGoalTemplate: vi.fn(),
	applyCloudUserMixGoalTemplate: vi.fn(),
	deleteCloudUserMixGoalTemplate: vi.fn(),
	saveCloudMixGoalConfiguration: vi.fn(),
	saveCloudUserMixGoalTemplate: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => mixGoalStorage);

import { createMixGoalConfigurationController } from "$lib/utils/mix/state/mixGoalConfigurationController.svelte";
import type { MixGoalMap, MixGoalTemplate } from "$lib/utils/mix/goals/types";

const createGoal = (
	nutrientId: number,
	targetAmount: number,
	sortOrder = 1,
) => ({
	nutrientId,
	goalType: "exact" as const,
	targetAmount,
	upperAmount: null,
	toleranceRatio: 0.05,
	importanceWeight: 1,
	sortOrder,
});

const defaultGoals: MixGoalMap = {
	1008: createGoal(1008, 350),
};

const systemTemplate: MixGoalTemplate = {
	id: "balanced",
	selectionId: "system:balanced-v1",
	scope: "system",
	versionId: "balanced-v1",
	version: 1,
	label: "Balanced",
	description: "Balanced goals",
	goalBasis: "per_mix",
	goals: defaultGoals,
	sourceKey: "blendcalc",
	sourceReference: null,
	reviewedAt: "2026-08-26T00:00:00.000Z",
	isDefault: true,
};

const createController = () => {
	const onGoalConfigurationChanged = vi.fn();
	const onTrackedNutrientsChanged = vi.fn();
	const controller = createMixGoalConfigurationController({
		initialSelectedNutrientIds: [1008],
		initialNutrientOptions: [{ id: 1008, label: "Calories" }],
		defaultGoals,
		defaultTemplate: systemTemplate,
		systemTemplates: [systemTemplate],
		nutrientCatalog: [
			{ id: 1008, label: "Calories", unit: "kcal" },
			{ id: 1003, label: "Protein", unit: "g" },
		],
		onGoalConfigurationChanged,
		onTrackedNutrientsChanged,
	});
	return {
		controller,
		onGoalConfigurationChanged,
		onTrackedNutrientsChanged,
	};
};

describe("createMixGoalConfigurationController", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mixGoalStorage.saveCloudMixGoalConfiguration.mockResolvedValue(
			defaultGoals,
		);
	});

	it("starts from the default template when the user has no saved configuration", () => {
		const { controller } = createController();

		expect(controller.state.goals).toEqual(defaultGoals);
		expect(controller.state.selectedTemplateId).toBe(
			systemTemplate.selectionId,
		);
		expect(controller.state.templateCustomized).toBe(false);
	});

	it("applies a template and synchronizes tracked nutrients", async () => {
		const proteinGoals = { 1003: createGoal(1003, 25) };
		const proteinTemplate: MixGoalTemplate = {
			...systemTemplate,
			id: "protein",
			selectionId: "system:protein-v1",
			versionId: "protein-v1",
			label: "Protein",
			goals: proteinGoals,
		};
		mixGoalStorage.applyCloudMixGoalTemplate.mockResolvedValue(proteinGoals);
		const onTrackedNutrientsChanged = vi.fn();
		const controller = createMixGoalConfigurationController({
			initialSelectedNutrientIds: [1008],
			initialNutrientOptions: [{ id: 1008, label: "Calories" }],
			defaultGoals,
			defaultTemplate: systemTemplate,
			systemTemplates: [systemTemplate, proteinTemplate],
			nutrientCatalog: [
				{ id: 1008, label: "Calories", unit: "kcal" },
				{ id: 1003, label: "Protein", unit: "g" },
			],
			onGoalConfigurationChanged: vi.fn(),
			onTrackedNutrientsChanged,
		});
		controller.selectTemplate(proteinTemplate.selectionId);

		const applied = await controller.applySelectedTemplate();

		expect(applied).toBe(true);
		expect(controller.state.goals).toEqual(proteinGoals);
		expect(controller.state.selectedNutrientIds).toEqual([1003]);
		expect(controller.state.nutrientOptions).toEqual([
			{ id: 1003, label: "Protein" },
		]);
		expect(onTrackedNutrientsChanged).toHaveBeenCalledOnce();
	});

	it("edits and persists a configured goal", async () => {
		const savedGoals = { 1008: createGoal(1008, 400) };
		mixGoalStorage.saveCloudMixGoalConfiguration.mockResolvedValue(savedGoals);
		const { controller, onGoalConfigurationChanged } = createController();

		controller.updateGoal(1008, "400");
		await vi.waitFor(() => {
			expect(mixGoalStorage.saveCloudMixGoalConfiguration).toHaveBeenCalledWith(
				expect.objectContaining({ goals: savedGoals }),
			);
		});

		expect(controller.state.goals).toEqual(savedGoals);
		expect(controller.state.templateCustomized).toBe(true);
		expect(onGoalConfigurationChanged).toHaveBeenCalled();
	});

	it("saves and applies a reusable user template", async () => {
		mixGoalStorage.saveCloudUserMixGoalTemplate.mockResolvedValue("template-1");
		mixGoalStorage.applyCloudUserMixGoalTemplate.mockResolvedValue(
			defaultGoals,
		);
		const { controller, onTrackedNutrientsChanged } = createController();

		const saved = await controller.saveCurrentTemplate("Weekday goals");

		expect(saved).toBe(true);
		expect(controller.state.userTemplates[0]).toEqual(
			expect.objectContaining({
				id: "template-1",
				label: "Weekday goals",
			}),
		);
		expect(controller.state.selectedTemplateId).toBe("user:template-1");
		expect(onTrackedNutrientsChanged).toHaveBeenCalledOnce();
	});

	it("removes a user template without changing active goal values", async () => {
		mixGoalStorage.saveCloudUserMixGoalTemplate.mockResolvedValue("template-1");
		mixGoalStorage.applyCloudUserMixGoalTemplate.mockResolvedValue(
			defaultGoals,
		);
		mixGoalStorage.deleteCloudUserMixGoalTemplate.mockResolvedValue(true);
		const { controller } = createController();
		await controller.saveCurrentTemplate("Temporary goals");
		const template = controller.state.userTemplates[0];

		const deleted = await controller.deleteTemplate(template);

		expect(deleted).toBe(true);
		expect(controller.state.userTemplates).toEqual([]);
		expect(controller.state.goals).toEqual(defaultGoals);
	});
});
