<script lang="ts">
	import {
		pushState,
		replaceState as replaceNavigationState,
	} from "$app/navigation";
	import { page } from "$app/state";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog/ConfirmationDialog.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog/TextInputDialog.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import GoalTargets from "$lib/components/mix/controls/GoalTargets/GoalTargets.svelte";
	import IngredientChooser from "$lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte";
	import SelectedIngredientsPanel from "$lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte";
	import IngredientContributionBreakdown from "$lib/components/mix/insights/IngredientContributionBreakdown/IngredientContributionBreakdown.svelte";
	import NutrientAdjustmentSuggestions from "$lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte";
	import NutrientShapePanel from "$lib/components/mix/insights/NutrientShapePanel/NutrientShapePanel.svelte";
	import MixWarnings from "$lib/components/mix/insights/MixWarnings/MixWarnings.svelte";
	import MixHeader from "$lib/components/mix/layout/MixHeader/MixHeader.svelte";
	import MixOptionsSheet from "$lib/components/mix/layout/MixOptionsSheet/MixOptionsSheet.svelte";
	import MixSectionOrganizer from "$lib/components/mix/layout/MixSectionOrganizer/MixSectionOrganizer.svelte";
	import SaveGoalReview from "$lib/components/mix/save/SaveGoalReview/SaveGoalReview.svelte";
	import {
		getNutrientCatalog,
		getDefaultMixFields,
		getDefaultMixGoalTemplate,
		getDefaultMixGoals,
		getMixGoalTemplates,
		getMixRuntimeConfiguration,
	} from "$lib/utils/food/reference/appReferenceCatalog";
	import type { FoodItem } from "$lib/utils/food/types";
	import { readIngredientList } from "$lib/utils/ingredients/ingredientListApi";
	import {
		getDefaultNutrientGoal,
		getMixAnalysis,
		getNutrientTotal as calculateNutrientTotal,
	} from "$lib/utils/mix/calculations";
	import {
		areMixGoalsEqual,
		createExactMixGoal,
		withMixGoalTargetAmount,
		type MixGoalBasis,
		type MixGoalMap,
		type MixGoalTemplate,
		type MixGoalType,
	} from "$lib/utils/mix/goals/types";
	import {
		buildMixRouteHref,
		getActiveMixRouteHref,
		getActiveMixRouteState,
		MIX_ROUTE_OVERLAYS,
		type MixRouteTarget,
	} from "$lib/utils/mix/navigation/mixRouteState";
	import { createMixHeaderVisibilityController } from "$lib/utils/mix/state/mixHeaderVisibilityController.svelte";
	import { createMixSectionPreferencesController } from "$lib/utils/mix/state/mixSectionPreferencesController.svelte";
	import { createSavedRecipeController } from "$lib/utils/mix/state/savedRecipeController.svelte";
	import {
		getDefaultMixState,
		getEmptyServingState,
		getMixStateSnapshot,
		getServingConversion as getServingConversionFromState,
		getServingQuantity as getServingQuantityFromState,
		getServingUnit as getServingUnitFromState,
		getStateWithGramServing,
		getStateWithServingAmount,
		getStateWithToggledFood,
		readStoredMixState,
		writeStoredMixState,
		writeStoredRawMixState,
		type MixStateSnapshot,
	} from "$lib/utils/mix/state/mixState";
	import {
		getDefaultNutrientOptions,
		getNutrientMeta,
		type NutrientOption,
	} from "$lib/utils/mix/ui/mixUi";
	import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
	import type { SavedRecipeInput } from "$lib/utils/storage/client/savedRecipes";
	import {
		preserveSelectedListItems,
		INGREDIENT_LISTS_CHANGED_EVENT,
	} from "$lib/utils/storage/client/ingredientLists";
	import {
		applyCloudMixGoalTemplate,
		applyCloudUserMixGoalTemplate,
		deleteCloudUserMixGoalTemplate,
		saveCloudMixGoalConfiguration,
		saveCloudMixPreferences,
		saveCloudUserMixGoalTemplate,
	} from "$lib/utils/storage/supabase";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import { onMount } from "svelte";
	import type { MixResetAction } from "./types";

	const defaultMixFields = getDefaultMixFields();
	const nutrientCatalog = getNutrientCatalog();
	const defaultNutrientGoals = getDefaultMixGoals();
	const defaultGoalTemplate = getDefaultMixGoalTemplate();
	const systemGoalTemplates = getMixGoalTemplates();
	const initialMixData = page.data.mixData;
	const initialCloudPreferences = initialMixData?.preferences;
	const initialCloudGoals = initialCloudPreferences?.nutrientGoals ?? {};
	const hasInitialGoalConfiguration =
		initialCloudPreferences?.hasGoalConfiguration ?? false;
	const initialGoalSourceSelectionId =
		initialCloudPreferences?.sourceGoalTemplateVersionId
			? (systemGoalTemplates.find(
					(template) =>
						template.versionId ===
						initialCloudPreferences.sourceGoalTemplateVersionId,
				)?.selectionId ?? "")
			: initialCloudPreferences?.sourceUserGoalTemplateId
				? `user:${initialCloudPreferences.sourceUserGoalTemplateId}`
				: hasInitialGoalConfiguration
					? ""
					: (defaultGoalTemplate?.selectionId ?? "");

	let selected = $state<(string | number)[]>(defaultMixFields.map((n) => n.id));
	let options = $state<NutrientOption[]>(getDefaultNutrientOptions());
	let fridgeItems = $state<FoodItem[]>(initialMixData?.fridge ?? []);
	let shoppingItems = $state<FoodItem[]>(initialMixData?.shoppingList ?? []);
	let selectedFoodIds = $state<number[]>([]);
	let servingGrams = $state<Record<number, number>>({});
	let servingQuantities = $state<Record<number, number>>({});
	let servingUnits = $state<Record<number, ServingMeasureUnit>>({});
	let nutrientGoals = $state<MixGoalMap>({
		...(hasInitialGoalConfiguration ? initialCloudGoals : defaultNutrientGoals),
	});
	let goalBasis = $state<MixGoalBasis>(
		hasInitialGoalConfiguration
			? (initialCloudPreferences?.goalBasis ?? "per_mix")
			: (defaultGoalTemplate?.goalBasis ?? "per_mix"),
	);
	let sourceGoalTemplateVersionId = $state<string | null>(
		hasInitialGoalConfiguration
			? (initialCloudPreferences?.sourceGoalTemplateVersionId ?? null)
			: (defaultGoalTemplate?.versionId ?? null),
	);
	let sourceUserGoalTemplateId = $state<string | null>(
		hasInitialGoalConfiguration
			? (initialCloudPreferences?.sourceUserGoalTemplateId ?? null)
			: null,
	);
	let goalTemplateCustomized = $state(
		hasInitialGoalConfiguration
			? (initialCloudPreferences?.goalTemplateCustomized ?? true)
			: !defaultGoalTemplate,
	);
	let userGoalTemplates = $state<MixGoalTemplate[]>(
		initialCloudPreferences?.userGoalTemplates ?? [],
	);
	let selectedGoalTemplateId = $state(initialGoalSourceSelectionId);
	let keepExtraGoals = $state(false);
	let goalPresetBusy = $state(false);
	let goalPresetError = $state("");
	let goalPresetDialogError = $state("");
	let goalPresetDialogBusy = $state(false);
	const goalTemplates = $derived([
		...systemGoalTemplates,
		...userGoalTemplates,
	]);
	let cloudLoadError = $state(initialMixData?.loadError ?? "");
	let mixStateReady = $state(false);
	let mixScrollContainer = $state<HTMLElement | null>(null);
	const sectionPreferences = createMixSectionPreferencesController({
		initialOrder: initialMixData?.preferences.sectionOrder,
		initialDisclosureState: initialMixData?.preferences.sectionDisclosureState,
	});
	const activeMixRouteHref = $derived(
		getActiveMixRouteHref(page.url, page.state.mixRouteHref),
	);
	const mixRouteState = $derived(
		getActiveMixRouteState(page.url, page.state.mixRouteHref),
	);
	const headerVisibility = createMixHeaderVisibilityController({
		isEnabled: () => mixRouteState.overlay === null,
	});
	const pendingResetAction = $derived<MixResetAction | null>(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.resetGoals
			? "goals"
			: mixRouteState.overlay === MIX_ROUTE_OVERLAYS.clearIngredients
				? "ingredients"
				: mixRouteState.overlay === MIX_ROUTE_OVERLAYS.resetAll
					? "all"
					: null,
	);
	const saveDialogOpen = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.save,
	);
	const optionsSheetOpen = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.options,
	);
	const reorganizeMode = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.reorganize,
	);
	const ingredientFiltersOpen = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.ingredientFilters,
	);
	const saveGoalPresetDialogOpen = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.saveGoalPreset,
	);
	const goalPresetPendingDeletion = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.deleteGoalPreset
			? (userGoalTemplates.find(
					(template) => template.id === mixRouteState.goalTemplateId,
				) ?? null)
			: null,
	);

	const navigateMixRoute = (
		target: MixRouteTarget,
		{ replaceState = false } = {},
	) => {
		const href = buildMixRouteHref(page.url, target);
		if (href === activeMixRouteHref) return;
		const nextPageState = { ...page.state, mixRouteHref: href };

		if (replaceState) {
			replaceNavigationState(href, nextPageState);
			return;
		}
		pushState(href, nextPageState);
	};

	const closeMixOverlay = () =>
		navigateMixRoute({ overlay: null }, { replaceState: true });

	const finishReorganizing = async () => {
		const saved = await sectionPreferences.saveOrder(
			sectionPreferences.state.order,
		);
		if (saved) closeMixOverlay();
	};

	const openWarningRoute = (warningId: string) => {
		navigateMixRoute({
			overlay: MIX_ROUTE_OVERLAYS.warningDetails,
			warningId,
		});
	};

	const openConversionDetailsRoute = (foodId: number) => {
		navigateMixRoute({
			overlay: MIX_ROUTE_OVERLAYS.conversionDetails,
			foodId,
		});
	};

	const assignMixState = (state: MixStateSnapshot) => {
		const goalBackedIds = new Set(Object.keys(nutrientGoals).map(Number));
		selected = state.selected.filter((id) => goalBackedIds.has(Number(id)));
		options = state.options.filter((option) =>
			goalBackedIds.has(Number(option.id)),
		);
		selectedFoodIds = state.selectedFoodIds;
		servingGrams = state.servingGrams;
		servingQuantities = state.servingQuantities;
		servingUnits = state.servingUnits;
	};

	const getCurrentMixState = () => {
		return getMixStateSnapshot({
			selected,
			options,
			selectedFoodIds,
			servingGrams,
			servingQuantities,
			servingUnits,
		});
	};

	const getServingQuantity = (food: FoodItem) => {
		return getServingQuantityFromState(food, servingQuantities);
	};

	const getServingUnit = (food: FoodItem) => {
		return getServingUnitFromState(food, servingUnits);
	};

	const getServingConversion = (food: FoodItem) => {
		return getServingConversionFromState(food, servingQuantities, servingUnits);
	};

	const selectedNutrients = $derived(
		selected.flatMap((id) => {
			const nutrient = getNutrientMeta(id, [defaultMixFields, nutrientCatalog]);
			return nutrient ? [nutrient] : [];
		}),
	);
	const allIngredientItems = $derived([...fridgeItems, ...shoppingItems]);
	const selectedFoods = $derived(
		allIngredientItems.filter((item) => selectedFoodIds.includes(item.fdcId)),
	);
	const savedRecipeController = createSavedRecipeController({
		buildSavedRecipeInput: (name): SavedRecipeInput => ({
			name,
			foods: selectedFoods,
			selected,
			options,
			nutrientGoals,
			goalBasis,
			servingGrams,
			servingQuantities,
			servingUnits,
		}),
		onRecipeSaved: closeMixOverlay,
	});
	const loadedSavedRecipe = $derived(savedRecipeController.state.loaded);
	const markLoadedSavedRecipeDirty = savedRecipeController.markDirty;
	const detachLoadedSavedRecipe = savedRecipeController.detach;
	const canSaveCurrentMix = $derived(
		selectedFoods.length > 0 && (!loadedSavedRecipe || loadedSavedRecipe.isDirty),
	);
	const hasCustomGoals = $derived.by(() => {
		return !areMixGoalsEqual(nutrientGoals, defaultNutrientGoals);
	});
	const hasCustomNutrientSelection = $derived.by(() => {
		const defaultIds = defaultMixFields.map((nutrient) => String(nutrient.id));
		return (
			selected.length !== defaultIds.length ||
			selected.some((id, index) => String(id) !== defaultIds[index])
		);
	});
	const hasResettableMixState = $derived(
		hasCustomGoals || hasCustomNutrientSelection || selectedFoodIds.length > 0,
	);
	const mixAnalysis = $derived(
		getMixAnalysis({
			nutrients: selectedNutrients,
			foods: selectedFoods,
			goals: nutrientGoals,
			servingGrams,
		}),
	);

	const getNutrientTotal = (nutrientId: number) => {
		return calculateNutrientTotal(selectedFoods, nutrientId, servingGrams);
	};

	const loadCloudBackedIngredientLists = async () => {
		const loadedFridge = fridgeItems;
		const loadedShoppingList = shoppingItems;

		try {
			const [nextFridge, nextShoppingList] = await Promise.all([
				readIngredientList(MIX_STORAGE_KEYS.fridge),
				readIngredientList(MIX_STORAGE_KEYS.shoppingList),
			]);
			const preservedFridge = preserveSelectedListItems(
				nextFridge,
				loadedFridge,
				selectedFoodIds,
			);
			const preservedShoppingList = preserveSelectedListItems(
				nextShoppingList,
				loadedShoppingList,
				selectedFoodIds,
			);

			fridgeItems = preservedFridge;
			shoppingItems = preservedShoppingList;
			cloudLoadError = "";
		} catch {
			cloudLoadError =
				"Your saved ingredient lists could not be loaded. Try again.";
		}
	};

	const loadIngredientLists = () => {
		void loadCloudBackedIngredientLists();
	};

	const saveNutrientGoals = async (
		nextGoals: MixGoalMap,
		{
			nextGoalBasis = goalBasis,
			nextSourceTemplateVersionId = sourceGoalTemplateVersionId,
			nextSourceUserTemplateId = sourceUserGoalTemplateId,
			nextTemplateCustomized = true,
		} = {},
	) => {
		goalPresetError = "";
		const savedGoals = await saveCloudMixGoalConfiguration({
			goals: nextGoals,
			goalBasis: nextGoalBasis,
			sourceTemplateVersionId: nextSourceTemplateVersionId,
			sourceUserTemplateId: nextSourceUserTemplateId,
			templateCustomized: nextTemplateCustomized,
		});
		if (!savedGoals) {
			goalPresetError =
				"Your nutrition goals could not be saved. Check your connection and try again.";
			return false;
		}

		nutrientGoals = savedGoals;
		goalBasis = nextGoalBasis;
		sourceGoalTemplateVersionId = nextSourceTemplateVersionId;
		sourceUserGoalTemplateId = nextSourceUserTemplateId;
		goalTemplateCustomized = nextTemplateCustomized;
		return true;
	};

	const loadMixState = () => {
		assignMixState(
			readStoredMixState(getCurrentMixState(), allIngredientItems),
		);
	};

	const saveMixState = () => {
		const mixState = getCurrentMixState();
		const persistedMixState = writeStoredMixState(mixState);
		void saveCloudMixPreferences({ mixState: persistedMixState });
	};

	const loadCloudBackedMixPreferences = () => {
		const cloudPreferences = initialMixData?.preferences;
		if (!cloudPreferences) return;

		const hasCloudMixState =
			cloudPreferences.mixState &&
			Object.keys(cloudPreferences.mixState).length > 0;

		if (hasCloudMixState) {
			writeStoredRawMixState(cloudPreferences.mixState ?? {});
			loadMixState();
		}

		sectionPreferences.replace({
			order: cloudPreferences.sectionOrder,
			disclosureState: cloudPreferences.sectionDisclosureState,
		});
	};

	const syncTrackedNutrientsToGoals = (
		nextGoals: MixGoalMap,
		keepExisting: boolean,
	) => {
		const goalIds = Object.values(nextGoals)
			.sort((left, right) => left.sortOrder - right.sortOrder)
			.map((goal) => goal.nutrientId);
		const nextSelected = keepExisting
			? [...new Set([...selected.map(Number), ...goalIds])]
			: goalIds;
		selected = nextSelected;
		options = [
			...options.filter((option) => nextSelected.includes(Number(option.id))),
			...nextSelected.flatMap((nutrientId) => {
				if (options.some((option) => Number(option.id) === nutrientId))
					return [];
				const nutrient = nutrientCatalog.find((item) => item.id === nutrientId);
				return nutrient ? [{ id: nutrient.id, label: nutrient.label }] : [];
			}),
		];
	};

	const applySelectedGoalTemplate = async (
		template: MixGoalTemplate,
		keepExistingGoals: boolean,
	) => {
		goalPresetBusy = true;
		goalPresetError = "";
		const savedGoals =
			template.scope === "system" && template.versionId
				? await applyCloudMixGoalTemplate(template.versionId, keepExistingGoals)
				: await applyCloudUserMixGoalTemplate(template.id, keepExistingGoals);
		goalPresetBusy = false;
		if (!savedGoals) {
			goalPresetError =
				"That goal preset could not be applied. Check your connection and try again.";
			return false;
		}

		nutrientGoals = savedGoals;
		goalBasis = template.goalBasis;
		sourceGoalTemplateVersionId =
			template.scope === "system" ? template.versionId : null;
		sourceUserGoalTemplateId = template.scope === "user" ? template.id : null;
		goalTemplateCustomized = keepExistingGoals;
		selectedGoalTemplateId = template.selectionId;
		syncTrackedNutrientsToGoals(savedGoals, keepExistingGoals);
		markLoadedSavedRecipeDirty();
		saveMixState();
		return true;
	};

	const resetGoals = async () => {
		detachLoadedSavedRecipe();
		if (defaultGoalTemplate) {
			await applySelectedGoalTemplate(defaultGoalTemplate, false);
			return;
		}
		nutrientGoals = { ...defaultNutrientGoals };
		selectedGoalTemplateId = "";
		await saveNutrientGoals(nutrientGoals, {
			nextSourceTemplateVersionId: null,
			nextSourceUserTemplateId: null,
			nextTemplateCustomized: true,
		});
	};

	const clearIngredients = () => {
		detachLoadedSavedRecipe();
		selectedFoodIds = [];
		const emptyServingState = getEmptyServingState();
		servingGrams = emptyServingState.servingGrams;
		servingQuantities = emptyServingState.servingQuantities;
		servingUnits = emptyServingState.servingUnits;
		saveMixState();
	};

	const resetMix = async () => {
		detachLoadedSavedRecipe();
		assignMixState(getDefaultMixState());
		await resetGoals();
		saveMixState();
	};

	const resetDialogContent = $derived.by(() => {
		if (pendingResetAction === "goals") {
			return {
				title: "Reset nutrition goals?",
				description: "Replace your current goal values with the app defaults?",
				confirmLabel: "Reset goals",
			};
		}
		if (pendingResetAction === "ingredients") {
			return {
				title: "Clear selected ingredients?",
				description:
					"Remove every selected ingredient and its entered amount from this draft?",
				confirmLabel: "Clear ingredients",
			};
		}
		return {
			title: "Reset the entire mix?",
			description:
				"Restore default nutrients and goals, and remove all selected ingredients?",
			confirmLabel: "Reset all",
		};
	});

	const confirmReset = () => {
		if (pendingResetAction === "goals") void resetGoals();
		if (pendingResetAction === "ingredients") clearIngredients();
		if (pendingResetAction === "all") void resetMix();
		closeMixOverlay();
	};

	const handleChange = (next: (string | number)[]) => {
		selected = next;
		markLoadedSavedRecipeDirty();
		saveMixState();
	};

	const handleAddNutrient = (
		nutrientId: string | number,
		targetAmount?: number,
	) => {
		const nutrient = nutrientCatalog.find((item) => item.id == nutrientId);
		if (!nutrient || selected.some((id) => id == nutrient.id)) return false;

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
				sortOrder: Object.keys(nutrientGoals).length + 1,
			});
		}

		if (!options.some((option) => option.id == nutrient.id)) {
			options = [...options, { id: nutrient.id, label: nutrient.label }];
		}
		selected = [...selected, nutrient.id];
		const nextGoals = {
			...nutrientGoals,
			[nutrient.id]: {
				...goal,
				sortOrder: Object.keys(nutrientGoals).length + 1,
			},
		};
		nutrientGoals = nextGoals;
		goalTemplateCustomized = true;
		markLoadedSavedRecipeDirty();
		saveMixState();
		void saveNutrientGoals(nextGoals);
		return true;
	};

	const handleRemoveNutrient = (nutrientId: string | number) => {
		const numericNutrientId = Number(nutrientId);
		handleChange(selected.filter((id) => id != nutrientId));
		const nextGoals = { ...nutrientGoals };
		delete nextGoals[numericNutrientId];
		nutrientGoals = Object.fromEntries(
			Object.values(nextGoals)
				.sort((left, right) => left.sortOrder - right.sortOrder)
				.map((goal, index) => [
					goal.nutrientId,
					{ ...goal, sortOrder: index + 1 },
				]),
		);
		goalTemplateCustomized = true;
		void saveNutrientGoals(nutrientGoals);
	};

	const previewGoal = (id: string | number, value: string) => {
		const nutrientId = Number(id);
		const existingGoal = nutrientGoals[nutrientId];
		const parsedValue = Number(value);
		if (!existingGoal || value.trim() === "" || !Number.isFinite(parsedValue)) {
			return;
		}
		nutrientGoals = {
			...nutrientGoals,
			[nutrientId]: withMixGoalTargetAmount(existingGoal, parsedValue),
		};
		markLoadedSavedRecipeDirty();
		goalTemplateCustomized = true;
	};

	const updateGoal = (id: string | number, value: string) => {
		previewGoal(id, value);
		const nextGoals = { ...nutrientGoals };
		nutrientGoals = nextGoals;
		markLoadedSavedRecipeDirty();
		void saveNutrientGoals(nextGoals);
	};

	const updateUpperGoal = (id: string | number, value: string) => {
		const nutrientId = Number(id);
		const goal = nutrientGoals[nutrientId];
		if (!goal || goal.goalType !== "range") return;
		const parsedValue = Number(value);
		const upperAmount = Number.isFinite(parsedValue)
			? Math.max(goal.targetAmount, parsedValue)
			: goal.targetAmount;
		const nextGoals = {
			...nutrientGoals,
			[nutrientId]: { ...goal, upperAmount },
		};
		nutrientGoals = nextGoals;
		markLoadedSavedRecipeDirty();
		void saveNutrientGoals(nextGoals);
	};

	const updateGoalType = (id: string | number, goalType: MixGoalType) => {
		const nutrientId = Number(id);
		const goal = nutrientGoals[nutrientId];
		if (!goal) return;
		const nextGoals = {
			...nutrientGoals,
			[nutrientId]: {
				...goal,
				goalType,
				upperAmount:
					goalType === "range"
						? Math.max(goal.upperAmount ?? goal.targetAmount, goal.targetAmount)
						: null,
			},
		};
		nutrientGoals = nextGoals;
		markLoadedSavedRecipeDirty();
		void saveNutrientGoals(nextGoals);
	};

	const openSaveGoalPresetDialog = () => {
		goalPresetDialogError = "";
		navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.saveGoalPreset });
	};

	const saveCurrentGoalPreset = async (displayName: string) => {
		const normalizedName = displayName.trim();
		if (!normalizedName) {
			goalPresetDialogError = "Give this goal preset a name first.";
			return;
		}

		goalPresetDialogBusy = true;
		goalPresetDialogError = "";
		const templateId = await saveCloudUserMixGoalTemplate({
			displayName: normalizedName,
			description: "Your saved nutrition goals.",
			goalBasis,
			goals: nutrientGoals,
			sourceTemplateVersionId: sourceGoalTemplateVersionId,
		});
		if (!templateId) {
			goalPresetDialogBusy = false;
			goalPresetDialogError =
				"That goal preset could not be saved. Check your connection and try again.";
			return;
		}

		const template: MixGoalTemplate = {
			id: templateId,
			selectionId: `user:${templateId}`,
			scope: "user",
			versionId: null,
			version: null,
			label: normalizedName,
			description: "Your saved nutrition goals.",
			goalBasis,
			goals: structuredClone(nutrientGoals),
			sourceKey: null,
			sourceReference: null,
			reviewedAt: null,
			isDefault: false,
		};
		userGoalTemplates = [
			template,
			...userGoalTemplates.filter((item) => item.id !== templateId),
		];
		goalPresetDialogBusy = false;
		closeMixOverlay();
		void applySelectedGoalTemplate(template, false);
	};

	const openDeleteGoalPresetDialog = (templateId: string) => {
		goalPresetDialogError = "";
		navigateMixRoute({
			overlay: MIX_ROUTE_OVERLAYS.deleteGoalPreset,
			goalTemplateId: templateId,
		});
	};

	const deleteGoalPreset = async () => {
		if (!goalPresetPendingDeletion) return;
		goalPresetDialogBusy = true;
		goalPresetDialogError = "";
		const deleted = await deleteCloudUserMixGoalTemplate(
			goalPresetPendingDeletion.id,
		);
		goalPresetDialogBusy = false;
		if (!deleted) {
			goalPresetDialogError =
				"That goal preset could not be deleted. Check your connection and try again.";
			return;
		}

		userGoalTemplates = userGoalTemplates.filter(
			(template) => template.id !== goalPresetPendingDeletion.id,
		);
		if (sourceUserGoalTemplateId === goalPresetPendingDeletion.id) {
			sourceUserGoalTemplateId = null;
			goalTemplateCustomized = true;
		}
		if (selectedGoalTemplateId === goalPresetPendingDeletion.selectionId) {
			selectedGoalTemplateId = "";
		}
		closeMixOverlay();
	};

	const updateGoalTemplateSelection = (templateId: string) => {
		selectedGoalTemplateId = templateId;
	};

	const applyGoalTemplate = async () => {
		const template = goalTemplates.find(
			(item) => item.selectionId === selectedGoalTemplateId,
		);
		if (!template) return false;
		return applySelectedGoalTemplate(template, keepExtraGoals);
	};

	const toggleFood = (foodId: number) => {
		assignMixState(
			getStateWithToggledFood(getCurrentMixState(), foodId, allIngredientItems),
		);
		markLoadedSavedRecipeDirty();
		saveMixState();
	};

	const applySuggestedAdjustment = (
		foodId: number,
		nextServingGrams: number,
	) => {
		assignMixState(
			nextServingGrams <= 0
				? getStateWithToggledFood(
						getCurrentMixState(),
						foodId,
						allIngredientItems,
					)
				: getStateWithGramServing(
						getCurrentMixState(),
						foodId,
						nextServingGrams,
					),
		);
		markLoadedSavedRecipeDirty();
		saveMixState();
	};

	const getServingConversionWarning = (food: FoodItem) => {
		return getServingConversion(food).warning;
	};

	const openWarningId = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.warningDetails
			? mixRouteState.warningId
			: null,
	);
	const conversionDetailsFoodId = $derived(
		mixRouteState.overlay === MIX_ROUTE_OVERLAYS.conversionDetails
			? mixRouteState.foodId
			: null,
	);

	const updateServingAmount = (
		food: FoodItem,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => {
		assignMixState(
			getStateWithServingAmount(
				getCurrentMixState(),
				food,
				quantityValue,
				unit,
			),
		);
		markLoadedSavedRecipeDirty();
		saveMixState();
	};

	onMount(() => {
		savedRecipeController.restore();
		loadMixState();
		loadCloudBackedMixPreferences();
		mixStateReady = true;
		window.addEventListener(INGREDIENT_LISTS_CHANGED_EVENT, loadIngredientLists);
		return () => {
			window.removeEventListener(
				INGREDIENT_LISTS_CHANGED_EVENT,
				loadIngredientLists,
			);
		};
	});

	$effect(() => {
		return headerVisibility.observe(mixScrollContainer);
	});

	$effect(() => {
		if (
			mixStateReady &&
			openWarningId !== null &&
			!mixAnalysis.warnings.some((warning) => warning.id === openWarningId)
		) {
			closeMixOverlay();
		}
	});

	$effect(() => {
		if (
			mixStateReady &&
			conversionDetailsFoodId !== null &&
			!selectedFoods.some(
				(food) =>
					food.fdcId === conversionDetailsFoodId &&
					Boolean(getServingConversionWarning(food)),
			)
		) {
			closeMixOverlay();
		}
	});
</script>

<ViewFrame appShell>
	<ConfirmationDialog
		open={pendingResetAction !== null}
		title={resetDialogContent.title}
		description={resetDialogContent.description}
		confirmLabel={resetDialogContent.confirmLabel}
		danger
		onConfirm={confirmReset}
		onCancel={closeMixOverlay}
	/>
	<ConfirmationDialog
		open={goalPresetPendingDeletion !== null}
		title="Delete goal preset?"
		description={goalPresetPendingDeletion
			? `Delete ${goalPresetPendingDeletion.label}? Your active goal values will stay in place.`
			: "Delete this goal preset?"}
		confirmLabel="Delete preset"
		busy={goalPresetDialogBusy}
		error={goalPresetDialogError}
		danger
		onConfirm={deleteGoalPreset}
		onCancel={closeMixOverlay}
	/>
	<ViewTop compactHidden={headerVisibility.state.hidden}>
		<MixHeader
			loadedName={loadedSavedRecipe?.name}
			isDirty={loadedSavedRecipe?.isDirty ?? selectedFoodIds.length > 0}
			canSave={canSaveCurrentMix}
			optionsOpen={optionsSheetOpen}
			onSave={() => {
				savedRecipeController.clearError();
				navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.save });
			}}
			onOpenOptions={() =>
				navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.options })}
		/>
	</ViewTop>

	<MixOptionsSheet
		open={optionsSheetOpen}
		canResetGoals={hasCustomGoals}
		canClearIngredients={selectedFoodIds.length > 0}
		canResetAll={hasResettableMixState}
		onClose={closeMixOverlay}
		onReorganize={() =>
			navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.reorganize })}
		onResetGoals={() =>
			navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.resetGoals })}
		onClearIngredients={() =>
			navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.clearIngredients })}
		onResetAll={() =>
			navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.resetAll })}
	/>

	<TextInputDialog
		open={saveDialogOpen}
		title="Review & Save Mix"
		description="Before saving, confirm these totals are close enough to your goals."
		label="Mix name"
		placeholder="Post-workout, Low sugar, High fiber…"
		initialValue={loadedSavedRecipe?.name ?? ""}
		error={savedRecipeController.state.error}
		busy={savedRecipeController.state.busy}
		confirmLabel={loadedSavedRecipe ? "Overwrite Existing" : "Save Recipe"}
		secondaryConfirmLabel={loadedSavedRecipe ? "Save as New" : ""}
		cancelLabel="Cancel"
		onConfirm={loadedSavedRecipe ? savedRecipeController.overwrite : savedRecipeController.saveAsNew}
		onSecondaryConfirm={loadedSavedRecipe ? savedRecipeController.saveAsNew : undefined}
		onValueChange={savedRecipeController.clearError}
		onCancel={() => {
			savedRecipeController.clearError();
			closeMixOverlay();
		}}
	>
		<SaveGoalReview diffs={mixAnalysis.diffs} />
	</TextInputDialog>

	<TextInputDialog
		open={saveGoalPresetDialogOpen}
		title="Save goal preset"
		description="Save these nutrition goals so you can use them again in another Mix."
		label="Preset name"
		placeholder="Weekday lunch, High protein…"
		confirmLabel="Save preset"
		error={goalPresetDialogError}
		busy={goalPresetDialogBusy}
		onConfirm={saveCurrentGoalPreset}
		onValueChange={() => (goalPresetDialogError = "")}
		onCancel={() => {
			goalPresetDialogError = "";
			closeMixOverlay();
		}}
	/>

	<ViewBody>
		<div
			class="mix-page"
			bind:this={mixScrollContainer}
			onscroll={headerVisibility.handleScroll}
		>
			{#if cloudLoadError}
				<StatusMessage tone="danger" title="Database lists unavailable">
					{cloudLoadError}
				</StatusMessage>
			{/if}
			{#if sectionPreferences.state.disclosureSaveError}
				<StatusMessage tone="warning" title="Section layout not saved">
					{sectionPreferences.state.disclosureSaveError}
				</StatusMessage>
			{/if}

			{#if reorganizeMode}
				<MixSectionOrganizer
					order={sectionPreferences.state.order}
					busy={sectionPreferences.state.orderSaveBusy}
					error={sectionPreferences.state.orderSaveError}
					onOrderChange={sectionPreferences.setOrder}
					onOrderCommit={(nextOrder) => {
						void sectionPreferences.saveOrder(nextOrder);
					}}
					onDone={() => {
						void finishReorganizing();
					}}
				/>
			{:else}
				<section class="mix-panel" aria-label="Mix builder">
					<div class="mix-builder">
						{#each sectionPreferences.state.order as sectionId (sectionId)}
							{#if sectionId === "nutrient-shape"}
							<NutrientShapePanel
								nutrientAxisCount={mixAnalysis.nutrientLabels.length}
									actualGoalRatios={mixAnalysis.chartValues}
									targetGoalRatios={mixAnalysis.goalValues}
									nutrientLabels={mixAnalysis.nutrientLabels}
									nutrientValueLabels={mixAnalysis.nutrientValueLabels}
									nutrientAxisColors={mixAnalysis.axisColors}
									actualFillColor={mixAnalysis.chartColors.fill}
									actualStrokeColor={mixAnalysis.chartColors.stroke}
									nutrientGoalDifferences={mixAnalysis.diffs}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "goals"}
								<GoalTargets
									{selectedNutrients}
									{nutrientGoals}
									{goalTemplates}
									{selectedGoalTemplateId}
									templateCustomized={goalTemplateCustomized}
									{keepExtraGoals}
									busy={goalPresetBusy}
									error={goalPresetError}
									onTemplateChange={updateGoalTemplateSelection}
									onKeepExtraGoalsChange={(value) => (keepExtraGoals = value)}
									onApplyTemplate={applyGoalTemplate}
									onSaveCurrentTemplate={openSaveGoalPresetDialog}
									onDeleteTemplate={openDeleteGoalPresetDialog}
									onPreviewGoal={previewGoal}
									onUpdateGoal={updateGoal}
									onUpdateUpperGoal={updateUpperGoal}
									onUpdateGoalType={updateGoalType}
									onAddNutrient={handleAddNutrient}
									onRemoveNutrient={handleRemoveNutrient}
									getGoal={getDefaultNutrientGoal}
									getTotal={getNutrientTotal}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "selected-ingredients"}
								<SelectedIngredientsPanel
									{selectedFoods}
									{fridgeItems}
									{selectedNutrients}
									{servingGrams}
									{getServingQuantity}
									{getServingUnit}
									{getServingConversion}
									{getServingConversionWarning}
									{conversionDetailsFoodId}
									onOpenConversionDetails={openConversionDetailsRoute}
									onCloseConversionDetails={closeMixOverlay}
									onRemove={toggleFood}
									onServingChange={updateServingAmount}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "add-ingredients"}
								<IngredientChooser
									{fridgeItems}
									{shoppingItems}
									{selectedFoodIds}
									onToggleFood={toggleFood}
									filtersOpen={ingredientFiltersOpen}
									onOpenFilters={() =>
										navigateMixRoute({
											overlay: MIX_ROUTE_OVERLAYS.ingredientFilters,
										})}
									onCloseFilters={closeMixOverlay}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "warnings"}
								<MixWarnings
									warnings={mixAnalysis.warnings}
									{openWarningId}
									onOpenWarning={openWarningRoute}
									onCloseWarning={closeMixOverlay}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "suggested-adjustments"}
								<NutrientAdjustmentSuggestions
									suggestions={mixAnalysis.adjustmentSuggestions}
									onApply={applySuggestedAdjustment}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "nutrient-contributions"}
								<IngredientContributionBreakdown
									breakdowns={mixAnalysis.contributionBreakdowns}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{/if}
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</ViewBody>
</ViewFrame>

<style lang="scss">
	@use "./page.scss";
</style>
