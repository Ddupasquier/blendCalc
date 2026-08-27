import {
	getDefaultNutrientGoal,
	type NutrientMeta,
} from "$lib/utils/mix/calculations";
import {
	createExactMixGoal,
	withMixGoalTargetAmount,
	type MixGoalBasis,
	type MixGoalMap,
	type MixGoalTemplate,
	type MixGoalType,
} from "$lib/utils/mix/goals/types";
import type { NutrientOption } from "$lib/utils/mix/ui/mixUi";
import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import type { CloudMixPreferences } from "$lib/utils/storage/supabase/shared";
import {
	applyCloudMixGoalTemplate,
	applyCloudUserMixGoalTemplate,
	deleteCloudUserMixGoalTemplate,
	saveCloudMixGoalConfiguration,
	saveCloudUserMixGoalTemplate,
} from "$lib/utils/storage/supabase";

type MixGoalConfigurationControllerOptions = {
	initialPreferences?: CloudMixPreferences;
	initialSelectedNutrientIds: (string | number)[];
	initialNutrientOptions: NutrientOption[];
	defaultGoals: MixGoalMap;
	defaultTemplate: MixGoalTemplate | null;
	systemTemplates: MixGoalTemplate[];
	nutrientCatalog: NutrientMeta[];
	onGoalConfigurationChanged: () => void;
	onTrackedNutrientsChanged: () => void;
};

type SaveGoalConfigurationOptions = {
	nextGoalBasis?: MixGoalBasis;
	nextSourceTemplateVersionId?: string | null;
	nextSourceUserTemplateId?: string | null;
	nextTemplateCustomized?: boolean;
};

const getInitialTemplateSelectionId = (
	preferences: CloudMixPreferences | undefined,
	systemTemplates: MixGoalTemplate[],
	defaultTemplate: MixGoalTemplate | null,
) => {
	if (preferences?.sourceGoalTemplateVersionId) {
		return (
			systemTemplates.find(
				(template) =>
					template.versionId === preferences.sourceGoalTemplateVersionId,
			)?.selectionId ?? ""
		);
	}
	if (preferences?.sourceUserGoalTemplateId) {
		return `user:${preferences.sourceUserGoalTemplateId}`;
	}
	return preferences?.hasGoalConfiguration
		? ""
		: (defaultTemplate?.selectionId ?? "");
};

export const createMixGoalConfigurationController = ({
	initialPreferences,
	initialSelectedNutrientIds,
	initialNutrientOptions,
	defaultGoals,
	defaultTemplate,
	systemTemplates,
	nutrientCatalog,
	onGoalConfigurationChanged,
	onTrackedNutrientsChanged,
}: MixGoalConfigurationControllerOptions) => {
	const hasInitialGoalConfiguration =
		initialPreferences?.hasGoalConfiguration ?? false;
	const state = $state({
		goals: {
			...(hasInitialGoalConfiguration
				? (initialPreferences?.nutrientGoals ?? {})
				: defaultGoals),
		} as MixGoalMap,
		goalBasis: (hasInitialGoalConfiguration
			? (initialPreferences?.goalBasis ?? "per_mix")
			: (defaultTemplate?.goalBasis ?? "per_mix")) as MixGoalBasis,
		sourceTemplateVersionId: hasInitialGoalConfiguration
			? (initialPreferences?.sourceGoalTemplateVersionId ?? null)
			: (defaultTemplate?.versionId ?? null),
		sourceUserTemplateId: hasInitialGoalConfiguration
			? (initialPreferences?.sourceUserGoalTemplateId ?? null)
			: null,
		templateCustomized: hasInitialGoalConfiguration
			? (initialPreferences?.goalTemplateCustomized ?? true)
			: !defaultTemplate,
		userTemplates: initialPreferences?.userGoalTemplates ?? [],
		selectedTemplateId: getInitialTemplateSelectionId(
			initialPreferences,
			systemTemplates,
			defaultTemplate,
		),
		keepExtraGoals: false,
		busy: false,
		error: "",
		dialogBusy: false,
		dialogError: "",
		selectedNutrientIds: initialSelectedNutrientIds,
		nutrientOptions: initialNutrientOptions,
	});
	let saveRequestId = 0;
	let saveQueue: Promise<void> = Promise.resolve();
	const templates = $derived([...systemTemplates, ...state.userTemplates]);

	const markGoalConfigurationChanged = () => {
		onGoalConfigurationChanged();
	};

	const markTrackedNutrientsChanged = () => {
		onTrackedNutrientsChanged();
	};

	const replaceTrackedNutrients = (
		selectedNutrientIds: (string | number)[],
		nutrientOptions: NutrientOption[],
	) => {
		const goalBackedIds = Object.keys(state.goals).map(Number);
		state.selectedNutrientIds = selectedNutrientIds.filter((id) =>
			goalBackedIds.includes(Number(id)),
		);
		state.nutrientOptions = nutrientOptions.filter((option) =>
			goalBackedIds.includes(Number(option.id)),
		);
	};

	const saveGoals = async (
		nextGoals: MixGoalMap,
		{
			nextGoalBasis = state.goalBasis,
			nextSourceTemplateVersionId = state.sourceTemplateVersionId,
			nextSourceUserTemplateId = state.sourceUserTemplateId,
			nextTemplateCustomized = true,
		}: SaveGoalConfigurationOptions = {},
	) => {
		const requestId = ++saveRequestId;
		state.error = "";
		let savedGoals: MixGoalMap | null = null;
		const saveRequest = saveQueue.then(async () => {
			savedGoals = await saveCloudMixGoalConfiguration({
				goals: nextGoals,
				goalBasis: nextGoalBasis,
				sourceTemplateVersionId: nextSourceTemplateVersionId,
				sourceUserTemplateId: nextSourceUserTemplateId,
				templateCustomized: nextTemplateCustomized,
			});
		});
		saveQueue = saveRequest.catch(() => undefined);
		await saveRequest;
		if (!savedGoals) {
			if (requestId === saveRequestId) {
				state.error =
					"Your nutrition goals could not be saved. Check your connection and try again.";
			}
			return false;
		}
		if (requestId !== saveRequestId) return true;

		state.goals = savedGoals;
		state.goalBasis = nextGoalBasis;
		state.sourceTemplateVersionId = nextSourceTemplateVersionId;
		state.sourceUserTemplateId = nextSourceUserTemplateId;
		state.templateCustomized = nextTemplateCustomized;
		return true;
	};

	const synchronizeTrackedNutrientsToGoals = (
		nextGoals: MixGoalMap,
		keepExisting: boolean,
	) => {
		const goalIds = Object.values(nextGoals)
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((goal) => goal.nutrientId);
		const nextSelectedNutrientIds = keepExisting
			? [...state.selectedNutrientIds.map(Number), ...goalIds].filter(
					(nutrientId, index, nutrientIds) =>
						nutrientIds.indexOf(nutrientId) === index,
				)
			: goalIds;
		state.selectedNutrientIds = nextSelectedNutrientIds;
		state.nutrientOptions = [
			...state.nutrientOptions.filter((option) =>
				nextSelectedNutrientIds.includes(Number(option.id)),
			),
			...nextSelectedNutrientIds.flatMap((nutrientId) => {
				if (
					state.nutrientOptions.some(
						(option) => Number(option.id) === nutrientId,
					)
				) {
					return [];
				}
				const nutrient = nutrientCatalog.find(
					(item) => Number(item.id) === nutrientId,
				);
				return nutrient
					? [{ id: nutrient.id, label: nutrient.label ?? "" }]
					: [];
			}),
		];
	};

	const applyTemplate = async (
		template: MixGoalTemplate,
		keepExistingGoals: boolean,
	) => {
		if (state.busy) return false;
		state.busy = true;
		state.error = "";
		let savedGoals: MixGoalMap | null;
		try {
			savedGoals =
				template.scope === "system" && template.versionId
					? await applyCloudMixGoalTemplate(
							template.versionId,
							keepExistingGoals,
						)
					: await applyCloudUserMixGoalTemplate(template.id, keepExistingGoals);
		} catch {
			savedGoals = null;
		} finally {
			state.busy = false;
		}
		if (!savedGoals) {
			state.error =
				"That goal preset could not be applied. Check your connection and try again.";
			return false;
		}

		state.goals = savedGoals;
		state.goalBasis = template.goalBasis;
		state.sourceTemplateVersionId =
			template.scope === "system" ? template.versionId : null;
		state.sourceUserTemplateId = template.scope === "user" ? template.id : null;
		state.templateCustomized = keepExistingGoals;
		state.selectedTemplateId = template.selectionId;
		synchronizeTrackedNutrientsToGoals(savedGoals, keepExistingGoals);
		markTrackedNutrientsChanged();
		return true;
	};

	const resetToDefaults = async () => {
		if (defaultTemplate) return applyTemplate(defaultTemplate, false);
		const saved = await saveGoals(
			{ ...defaultGoals },
			{
				nextSourceTemplateVersionId: null,
				nextSourceUserTemplateId: null,
				nextTemplateCustomized: true,
			},
		);
		if (!saved) return false;
		state.selectedTemplateId = "";
		markGoalConfigurationChanged();
		return true;
	};

	const addNutrient = (nutrientId: string | number, targetAmount?: number) => {
		const nutrient = nutrientCatalog.find(
			(item) => String(item.id) === String(nutrientId),
		);
		if (
			!nutrient ||
			state.selectedNutrientIds.some((id) => String(id) === String(nutrient.id))
		) {
			return false;
		}

		let goal = getDefaultNutrientGoal(nutrient);
		if (!goal) {
			if (
				targetAmount === undefined ||
				!Number.isFinite(targetAmount) ||
				targetAmount < 0
			) {
				return false;
			}
			goal = createExactMixGoal({
				nutrientId: Number(nutrient.id),
				targetAmount,
				toleranceRatio: getMixRuntimeConfiguration().pointGoalTolerance,
				sortOrder: Object.keys(state.goals).length + 1,
			});
		}

		if (
			!state.nutrientOptions.some(
				(option) => String(option.id) === String(nutrient.id),
			)
		) {
			state.nutrientOptions = [
				...state.nutrientOptions,
				{ id: nutrient.id, label: nutrient.label ?? "" },
			];
		}
		state.selectedNutrientIds = [...state.selectedNutrientIds, nutrient.id];
		const nextGoals = {
			...state.goals,
			[nutrient.id]: {
				...goal,
				sortOrder: Object.keys(state.goals).length + 1,
			},
		};
		state.goals = nextGoals;
		state.templateCustomized = true;
		markTrackedNutrientsChanged();
		void saveGoals(nextGoals);
		return true;
	};

	const removeNutrient = (nutrientId: string | number) => {
		const numericNutrientId = Number(nutrientId);
		state.selectedNutrientIds = state.selectedNutrientIds.filter(
			(id) => String(id) !== String(nutrientId),
		);
		const nextGoals = { ...state.goals };
		delete nextGoals[numericNutrientId];
		state.goals = Object.fromEntries(
			Object.values(nextGoals)
				.sort((left, right) => left.sortOrder - right.sortOrder)
				.map((goal, index) => [
					goal.nutrientId,
					{ ...goal, sortOrder: index + 1 },
				]),
		);
		state.templateCustomized = true;
		markTrackedNutrientsChanged();
		void saveGoals(state.goals);
	};

	const previewGoal = (id: string | number, value: string) => {
		const nutrientId = Number(id);
		const existingGoal = state.goals[nutrientId];
		const parsedValue = Number(value);
		if (!existingGoal || value.trim() === "" || !Number.isFinite(parsedValue)) {
			return;
		}
		saveRequestId += 1;
		state.goals = {
			...state.goals,
			[nutrientId]: withMixGoalTargetAmount(existingGoal, parsedValue),
		};
		state.templateCustomized = true;
		markGoalConfigurationChanged();
	};

	const updateGoal = (id: string | number, value: string) => {
		previewGoal(id, value);
		const nextGoals = { ...state.goals };
		state.goals = nextGoals;
		markGoalConfigurationChanged();
		void saveGoals(nextGoals);
	};

	const previewUpperGoal = (id: string | number, value: string) => {
		const nutrientId = Number(id);
		const goal = state.goals[nutrientId];
		if (!goal || goal.goalType !== "range") return;
		const parsedValue = Number(value);
		if (value.trim() === "" || !Number.isFinite(parsedValue)) return;
		saveRequestId += 1;
		state.goals = {
			...state.goals,
			[nutrientId]: {
				...goal,
				upperAmount: Math.max(goal.targetAmount, parsedValue),
			},
		};
		state.templateCustomized = true;
		markGoalConfigurationChanged();
	};

	const updateUpperGoal = (id: string | number, value: string) => {
		previewUpperGoal(id, value);
		const nextGoals = { ...state.goals };
		state.goals = nextGoals;
		markGoalConfigurationChanged();
		void saveGoals(nextGoals);
	};

	const updateGoalType = (id: string | number, goalType: MixGoalType) => {
		const nutrientId = Number(id);
		const goal = state.goals[nutrientId];
		if (!goal) return;
		const nextGoals = {
			...state.goals,
			[nutrientId]: {
				...goal,
				goalType,
				upperAmount:
					goalType === "range"
						? Math.max(goal.upperAmount ?? goal.targetAmount, goal.targetAmount)
						: null,
			},
		};
		state.goals = nextGoals;
		state.templateCustomized = true;
		markGoalConfigurationChanged();
		void saveGoals(nextGoals);
	};

	const saveCurrentTemplate = async (displayName: string) => {
		const normalizedName = displayName.trim();
		if (state.dialogBusy) return false;
		if (!normalizedName) {
			state.dialogError = "Give this goal preset a name first.";
			return false;
		}

		state.dialogBusy = true;
		state.dialogError = "";
		let templateId: string | null = null;
		try {
			templateId = await saveCloudUserMixGoalTemplate({
				displayName: normalizedName,
				description: "Your saved nutrition goals.",
				goalBasis: state.goalBasis,
				goals: state.goals,
				sourceTemplateVersionId: state.sourceTemplateVersionId,
			});
		} catch {
			templateId = null;
		} finally {
			state.dialogBusy = false;
		}
		if (!templateId) {
			state.dialogError =
				"That goal preset could not be saved. Check your connection and try again.";
			return false;
		}

		const template: MixGoalTemplate = {
			id: templateId,
			selectionId: `user:${templateId}`,
			scope: "user",
			versionId: null,
			version: null,
			label: normalizedName,
			description: "Your saved nutrition goals.",
			goalBasis: state.goalBasis,
			goals: structuredClone(state.goals),
			sourceKey: null,
			sourceReference: null,
			reviewedAt: null,
			isDefault: false,
		};
		state.userTemplates = [
			template,
			...state.userTemplates.filter((item) => item.id !== templateId),
		];
		return applyTemplate(template, false);
	};

	const deleteTemplate = async (template: MixGoalTemplate | null) => {
		if (!template || state.dialogBusy) return false;
		state.dialogBusy = true;
		state.dialogError = "";
		let deleted: boolean;
		try {
			deleted = await deleteCloudUserMixGoalTemplate(template.id);
		} catch {
			deleted = false;
		} finally {
			state.dialogBusy = false;
		}
		if (!deleted) {
			state.dialogError =
				"That goal preset could not be deleted. Check your connection and try again.";
			return false;
		}

		state.userTemplates = state.userTemplates.filter(
			(userTemplate) => userTemplate.id !== template.id,
		);
		if (state.sourceUserTemplateId === template.id) {
			state.sourceUserTemplateId = null;
			state.templateCustomized = true;
		}
		if (state.selectedTemplateId === template.selectionId) {
			state.selectedTemplateId = "";
		}
		return true;
	};

	const applySelectedTemplate = () => {
		const template = templates.find(
			(item) => item.selectionId === state.selectedTemplateId,
		);
		return template
			? applyTemplate(template, state.keepExtraGoals)
			: Promise.resolve(false);
	};

	return {
		state,
		get templates() {
			return templates;
		},
		findUserTemplate: (templateId: string | null) =>
			state.userTemplates.find((template) => template.id === templateId) ??
			null,
		replaceTrackedNutrients,
		resetToDefaults,
		addNutrient,
		removeNutrient,
		previewGoal,
		updateGoal,
		previewUpperGoal,
		updateUpperGoal,
		updateGoalType,
		selectTemplate: (templateId: string) => {
			state.selectedTemplateId = templateId;
		},
		setKeepExtraGoals: (keepExtraGoals: boolean) => {
			state.keepExtraGoals = keepExtraGoals;
		},
		applySelectedTemplate,
		saveCurrentTemplate,
		deleteTemplate,
		clearDialogError: () => {
			state.dialogError = "";
		},
	};
};

export type MixGoalConfigurationController = ReturnType<
	typeof createMixGoalConfigurationController
>;
