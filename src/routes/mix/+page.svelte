<script lang="ts">
	import { page } from "$app/state";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog/ConfirmationDialog.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog/TextInputDialog.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		resolveDelightMessage,
		resolveMixDelightMessage,
	} from "$lib/utils/delight/delightMessages";
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
	} from "$lib/utils/food/reference/appReferenceCatalog";
	import type { FoodItem } from "$lib/utils/food/types";
	import { readIngredientList } from "$lib/utils/ingredients/ingredientListApi";
	import {
		getDefaultNutrientGoal,
		getMixAnalysis,
		getNutrientTotal as calculateNutrientTotal,
	} from "$lib/utils/mix/calculations";
	import { areMixGoalsEqual } from "$lib/utils/mix/goals/types";
	import {
		buildMixRouteHref,
		getActiveMixRouteHref,
		getActiveMixRouteState,
		MIX_ROUTE_OVERLAYS,
		type MixRouteTarget,
	} from "$lib/utils/mix/navigation/mixRouteState";
	import { createScrollAwareHeaderVisibilityController } from "$lib/utils/navigation/scrollAwareHeaderVisibilityController.svelte";
	import { navigateShallowRoute } from "$lib/utils/navigation/shallowRouteNavigation";
	import { SHALLOW_ROUTE_PAGE_STATE_KEYS } from "$lib/utils/navigation/shallowRouteState";
	import { createMixSectionPreferencesController } from "$lib/utils/mix/state/mixSectionPreferencesController.svelte";
	import { createMixDraftPersistenceController } from "$lib/utils/mix/state/mixDraftPersistenceController.svelte";
	import { createMixGoalConfigurationController } from "$lib/utils/mix/state/mixGoalConfigurationController.svelte";
	import { createSavedRecipeController } from "$lib/utils/mix/state/savedRecipeController.svelte";
	import {
		getDefaultMixState,
		getEmptyServingState,
		getMixStateSnapshot,
		getServingConversion as getServingConversionFromState,
		getServingConversions as getServingConversionsFromState,
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
	import { getNutrientMeta } from "$lib/utils/mix/ui/mixUi";
	import { getMixSectionOrderForIngredientAvailability } from "$lib/utils/mix/ui/mixSectionOrder";
	import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
	import type { SavedRecipeInput } from "$lib/utils/storage/client/savedRecipes";
	import {
		preserveSelectedListItems,
		INGREDIENT_LISTS_CHANGED_EVENT,
	} from "$lib/utils/storage/client/ingredientLists";
	import { saveCloudMixPreferences } from "$lib/utils/storage/supabase";
	import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

	import { onMount } from "svelte";
	import type { MixResetAction } from "./types";

	const allowPlayfulMessages = $derived(
		page.data.authUser?.playfulMessagesEnabled ?? true,
	);

	const defaultMixFields = getDefaultMixFields();
	const nutrientCatalog = getNutrientCatalog();
	const defaultNutrientGoals = getDefaultMixGoals();
	const defaultGoalTemplate = getDefaultMixGoalTemplate();
	const systemGoalTemplates = getMixGoalTemplates();
	const initialMixData = page.data.mixData;
	const initialCloudPreferences = initialMixData?.preferences;
	const initialFoodPreferences = initialMixData?.foodPreferences;
	const prioritizedNutrientIds =
		initialFoodPreferences?.prioritizedNutrientIds ?? [];
	const preferredServingGrams = initialFoodPreferences?.defaultMixServingGrams;
	const preferredWeightUnit =
		initialFoodPreferences?.unitSystem === "us" ? "oz" : "g";
	const initialDefaultMixState = getDefaultMixState(prioritizedNutrientIds);
	let fridgeItems = $state<FoodItem[]>(initialMixData?.fridge ?? []);
	let shoppingItems = $state<FoodItem[]>(initialMixData?.shoppingList ?? []);
	let selectedFoodIds = $state<number[]>([]);
	let servingGrams = $state<Record<number, number>>({});
	let servingQuantities = $state<Record<number, number>>({});
	let servingUnits = $state<Record<number, ServingMeasureUnit>>({});
	let resetActionBusy = $state(false);
	let resetActionError = $state("");
	let suggestedAdjustmentUndo = $state<{
		foodDescription: string;
		previousMixState: MixStateSnapshot;
	} | null>(null);
	let cloudLoadError = $state(initialMixData?.loadError ?? "");
	let mixStateReady = $state(false);
	let mixScrollContainer = $state<HTMLElement | null>(null);
	const goalConfiguration = createMixGoalConfigurationController({
		initialPreferences: initialCloudPreferences,
		initialSelectedNutrientIds: initialDefaultMixState.selected,
		initialNutrientOptions: initialDefaultMixState.options,
		defaultGoals: defaultNutrientGoals,
		defaultTemplate: defaultGoalTemplate ?? null,
		systemTemplates: systemGoalTemplates,
		nutrientCatalog,
		onGoalConfigurationChanged: () => markLoadedSavedRecipeDirty(),
		onTrackedNutrientsChanged: () => {
			markLoadedSavedRecipeDirty();
			saveMixState();
		},
	});
	const sectionPreferences = createMixSectionPreferencesController({
		initialOrder: initialMixData?.preferences.sectionOrder,
		initialDisclosureState: initialMixData?.preferences.sectionDisclosureState,
	});
	const mixDraftPersistence =
		createMixDraftPersistenceController<MixStateSnapshot>({
			persistDraft: (mixState) => saveCloudMixPreferences({ mixState }),
		});
	const activeMixRouteHref = $derived(
		getActiveMixRouteHref(page.url, page.state.mixRouteHref),
	);
	const mixRouteState = $derived(
		getActiveMixRouteState(page.url, page.state.mixRouteHref),
	);
	const headerVisibility = createScrollAwareHeaderVisibilityController({
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
			? goalConfiguration.findUserTemplate(mixRouteState.goalTemplateId)
			: null,
	);

	const navigateMixRoute = (
		target: MixRouteTarget,
		{ replaceState = false } = {},
	) => {
		const href = buildMixRouteHref(page.url, target);
		if (href === activeMixRouteHref) return;
		navigateShallowRoute({
			href,
			pageState: page.state,
			routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.mix,
			replace: replaceState,
		});
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
		goalConfiguration.replaceTrackedNutrients(state.selected, state.options);
		selectedFoodIds = state.selectedFoodIds;
		servingGrams = state.servingGrams;
		servingQuantities = state.servingQuantities;
		servingUnits = state.servingUnits;
	};

	const getCurrentMixState = () => {
		return getMixStateSnapshot({
			selected: goalConfiguration.state.selectedNutrientIds,
			options: goalConfiguration.state.nutrientOptions,
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
		goalConfiguration.state.selectedNutrientIds.flatMap((id) => {
			const nutrient = getNutrientMeta(id, [defaultMixFields, nutrientCatalog]);
			return nutrient ? [nutrient] : [];
		}),
	);
	const allIngredientItems = $derived([...fridgeItems, ...shoppingItems]);
	const hasAvailableIngredients = $derived(allIngredientItems.length > 0);
	const displayedSectionOrder = $derived(
		getMixSectionOrderForIngredientAvailability(
			sectionPreferences.state.order,
			hasAvailableIngredients,
		),
	);
	const selectedFoods = $derived(
		allIngredientItems.filter((item) => selectedFoodIds.includes(item.fdcId)),
	);
	const servingConversions = $derived(
		getServingConversionsFromState(
			selectedFoods,
			servingQuantities,
			servingUnits,
		),
	);
	let recipeSavedDelightMessage = $state<string | null>(null);
	const handleRecipeSaved = () => {
		recipeSavedDelightMessage =
			mixAnalysis.warnings.length === 0
				? resolveDelightMessage(
						[
							{
								contextKey: "saved",
								triggerKey: "recipe-saved",
							},
						],
						{ allowPlayfulMessages },
					)
				: null;
		closeMixOverlay();
	};
	const savedRecipeController = createSavedRecipeController({
		buildSavedRecipeInput: (name): SavedRecipeInput => ({
			name,
			foods: selectedFoods,
			selected: goalConfiguration.state.selectedNutrientIds,
			options: goalConfiguration.state.nutrientOptions,
			nutrientGoals: goalConfiguration.state.goals,
			goalBasis: goalConfiguration.state.goalBasis,
			servingGrams,
			servingQuantities,
			servingUnits,
		}),
		onRecipeSaved: handleRecipeSaved,
	});
	const loadedSavedRecipe = $derived(savedRecipeController.state.loaded);
	const markLoadedSavedRecipeDirty = () => {
		recipeSavedDelightMessage = null;
		savedRecipeController.markDirty();
	};
	const detachLoadedSavedRecipe = () => {
		recipeSavedDelightMessage = null;
		savedRecipeController.detach();
	};
	const canSaveCurrentMix = $derived(
		selectedFoods.length > 0 &&
			(!loadedSavedRecipe || loadedSavedRecipe.isDirty),
	);
	const hasCustomGoals = $derived.by(() => {
		return !areMixGoalsEqual(
			goalConfiguration.state.goals,
			defaultNutrientGoals,
		);
	});
	const hasCustomNutrientSelection = $derived.by(() => {
		const defaultIds = defaultMixFields.map((nutrient) => String(nutrient.id));
		return (
			goalConfiguration.state.selectedNutrientIds.length !==
				defaultIds.length ||
			goalConfiguration.state.selectedNutrientIds.some(
				(id, index) => String(id) !== defaultIds[index],
			)
		);
	});
	const hasResettableMixState = $derived(
		hasCustomGoals || hasCustomNutrientSelection || selectedFoodIds.length > 0,
	);
	const mixAnalysis = $derived(
		getMixAnalysis({
			nutrients: selectedNutrients,
			foods: selectedFoods,
			goals: goalConfiguration.state.goals,
			servingGrams,
			servingConversions,
		}),
	);
	const mixDelightMessage = $derived(
		resolveMixDelightMessage({
			foods: selectedFoods,
			servingGrams,
			goalDifferences: mixAnalysis.diffs,
			hasDangerWarning: mixAnalysis.warnings.some(
				(warning) => warning.severity === "danger",
			),
			allowPlayfulMessages,
		}),
	);

	const getNutrientTotal = (nutrientId: number) => {
		return calculateNutrientTotal(
			selectedFoods,
			nutrientId,
			servingGrams,
			servingConversions,
		);
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

	const loadMixState = () => {
		suggestedAdjustmentUndo = null;
		assignMixState(
			readStoredMixState(getCurrentMixState(), allIngredientItems),
		);
	};

	const saveMixState = () => {
		const mixState = getCurrentMixState();
		const persistedMixState = writeStoredMixState(mixState);
		return mixDraftPersistence.save(persistedMixState);
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

	const resetGoals = async ({ detachRecipe = true } = {}) => {
		const saved = await goalConfiguration.resetToDefaults();
		if (!saved) return false;
		if (detachRecipe) detachLoadedSavedRecipe();
		return true;
	};

	const clearIngredients = async () => {
		const previousMixState = getCurrentMixState();
		suggestedAdjustmentUndo = null;
		selectedFoodIds = [];
		const emptyServingState = getEmptyServingState();
		servingGrams = emptyServingState.servingGrams;
		servingQuantities = emptyServingState.servingQuantities;
		servingUnits = emptyServingState.servingUnits;
		const saved = await saveMixState();
		if (!saved) {
			assignMixState(previousMixState);
			writeStoredMixState(previousMixState);
			return false;
		}
		detachLoadedSavedRecipe();
		return true;
	};

	const resetMix = async () => {
		const previousMixState = getCurrentMixState();
		const goalsReset = await resetGoals({ detachRecipe: false });
		if (!goalsReset) return false;
		suggestedAdjustmentUndo = null;
		assignMixState(getDefaultMixState(prioritizedNutrientIds));
		const saved = await saveMixState();
		if (!saved) {
			assignMixState(previousMixState);
			writeStoredMixState(previousMixState);
			markLoadedSavedRecipeDirty();
			return false;
		}
		detachLoadedSavedRecipe();
		return true;
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

	const confirmReset = async () => {
		if (!pendingResetAction || resetActionBusy) return;
		resetActionBusy = true;
		resetActionError = "";
		let completed = false;
		try {
			if (pendingResetAction === "goals") completed = await resetGoals();
			if (pendingResetAction === "ingredients")
				completed = await clearIngredients();
			if (pendingResetAction === "all") completed = await resetMix();
		} catch {
			completed = false;
		} finally {
			resetActionBusy = false;
		}

		if (completed) {
			closeMixOverlay();
			return;
		}
		resetActionError =
			"Those changes could not be saved. Your current Mix is still open so you can try again.";
	};

	const handleAddNutrient = (
		nutrientId: string | number,
		targetAmount?: number,
	) => goalConfiguration.addNutrient(nutrientId, targetAmount);

	const handleRemoveNutrient = (nutrientId: string | number) =>
		goalConfiguration.removeNutrient(nutrientId);

	const previewGoal = goalConfiguration.previewGoal;
	const updateGoal = goalConfiguration.updateGoal;
	const previewUpperGoal = goalConfiguration.previewUpperGoal;
	const updateUpperGoal = goalConfiguration.updateUpperGoal;
	const updateGoalType = goalConfiguration.updateGoalType;

	const openSaveGoalPresetDialog = () => {
		goalConfiguration.clearDialogError();
		navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.saveGoalPreset });
	};

	const saveCurrentGoalPreset = async (displayName: string) => {
		const saved = await goalConfiguration.saveCurrentTemplate(displayName);
		if (saved) closeMixOverlay();
	};

	const openDeleteGoalPresetDialog = (templateId: string) => {
		goalConfiguration.clearDialogError();
		navigateMixRoute({
			overlay: MIX_ROUTE_OVERLAYS.deleteGoalPreset,
			goalTemplateId: templateId,
		});
	};

	const deleteGoalPreset = async () => {
		const deleted = await goalConfiguration.deleteTemplate(
			goalPresetPendingDeletion,
		);
		if (deleted) closeMixOverlay();
	};

	const updateGoalTemplateSelection = goalConfiguration.selectTemplate;
	const applyGoalTemplate = goalConfiguration.applySelectedTemplate;

	const toggleFood = (foodId: number) => {
		suggestedAdjustmentUndo = null;
		assignMixState(
			getStateWithToggledFood(
				getCurrentMixState(),
				foodId,
				allIngredientItems,
				{
					preferredServingGrams,
					preferredWeightUnit,
				},
			),
		);
		markLoadedSavedRecipeDirty();
		saveMixState();
	};

	const applySuggestedAdjustment = (
		foodId: number,
		nextServingGrams: number,
	) => {
		const previousMixState = getCurrentMixState();
		const foodDescription = allIngredientItems.find(
			(food) => food.fdcId === foodId,
		)?.description;
		assignMixState(
			nextServingGrams <= 0
				? getStateWithToggledFood(previousMixState, foodId, allIngredientItems)
				: getStateWithGramServing(previousMixState, foodId, nextServingGrams),
		);
		suggestedAdjustmentUndo = foodDescription
			? { foodDescription, previousMixState }
			: null;
		markLoadedSavedRecipeDirty();
		saveMixState();
	};

	const undoSuggestedAdjustment = () => {
		if (!suggestedAdjustmentUndo) return;
		const previousMixState = suggestedAdjustmentUndo.previousMixState;
		suggestedAdjustmentUndo = null;
		assignMixState(previousMixState);
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
		suggestedAdjustmentUndo = null;
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
		window.addEventListener(
			INGREDIENT_LISTS_CHANGED_EVENT,
			loadIngredientLists,
		);
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
		busy={resetActionBusy}
		error={resetActionError}
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
		busy={goalConfiguration.state.dialogBusy}
		error={goalConfiguration.state.dialogError}
		danger
		onConfirm={deleteGoalPreset}
		onCancel={closeMixOverlay}
	/>
	<ViewTop compactHidden={headerVisibility.state.hidden}>
		<MixHeader
			loadedName={loadedSavedRecipe?.name}
			delightMessage={recipeSavedDelightMessage}
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
		onConfirm={loadedSavedRecipe
			? savedRecipeController.overwrite
			: savedRecipeController.saveAsNew}
		onSecondaryConfirm={loadedSavedRecipe
			? savedRecipeController.saveAsNew
			: undefined}
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
		error={goalConfiguration.state.dialogError}
		busy={goalConfiguration.state.dialogBusy}
		onConfirm={saveCurrentGoalPreset}
		onValueChange={goalConfiguration.clearDialogError}
		onCancel={() => {
			goalConfiguration.clearDialogError();
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
			{#if mixDraftPersistence.state.error}
				<StatusMessage tone="warning" title="Latest Mix changes not saved">
					{mixDraftPersistence.state.error}
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
						{#each displayedSectionOrder as sectionId (sectionId)}
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
									delightMessage={mixDelightMessage}
									open={sectionPreferences.state.disclosureState[sectionId]}
									onOpenChange={(open) =>
										sectionPreferences.setDisclosure(sectionId, open)}
								/>
							{:else if sectionId === "goals"}
								<GoalTargets
									{selectedNutrients}
									nutrientGoals={goalConfiguration.state.goals}
									goalTemplates={goalConfiguration.templates}
									selectedGoalTemplateId={goalConfiguration.state
										.selectedTemplateId}
									templateCustomized={goalConfiguration.state
										.templateCustomized}
									keepExtraGoals={goalConfiguration.state.keepExtraGoals}
									busy={goalConfiguration.state.busy}
									error={goalConfiguration.state.error}
									onTemplateChange={updateGoalTemplateSelection}
									onKeepExtraGoalsChange={goalConfiguration.setKeepExtraGoals}
									onApplyTemplate={applyGoalTemplate}
									onSaveCurrentTemplate={openSaveGoalPresetDialog}
									onDeleteTemplate={openDeleteGoalPresetDialog}
									onPreviewGoal={previewGoal}
									onPreviewUpperGoal={previewUpperGoal}
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
									open={hasAvailableIngredients
										? sectionPreferences.state.disclosureState[sectionId]
										: true}
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
									lastAppliedFoodDescription={suggestedAdjustmentUndo?.foodDescription}
									onApply={applySuggestedAdjustment}
									onUndo={undoSuggestedAdjustment}
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
