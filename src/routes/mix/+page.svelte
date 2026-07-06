<script lang="ts">
	import GoalTargets from "$lib/components/mix/controls/GoalTargets.svelte";
	import IngredientChooser from "$lib/components/mix/ingredients/IngredientChooser.svelte";
	import MixEmptyState from "$lib/components/mix/states/MixEmptyState.svelte";
	import NutrientAdjustmentSuggestions from "$lib/components/mix/insights/NutrientAdjustmentSuggestions.svelte";
	import NutrientSelector from "$lib/components/mix/controls/NutrientSelector.svelte";
	import PointShape from "$lib/components/mix/insights/PointShape.svelte";
	import SaveGoalReview from "$lib/components/mix/save/SaveGoalReview.svelte";
	import SelectedIngredientsPanel from "$lib/components/mix/ingredients/SelectedIngredientsPanel.svelte";
	import SmartWarnings from "$lib/components/mix/insights/SmartWarnings.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog.svelte";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog.svelte";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import {
		getFoodPreferenceSmartWarnings,
        getNutrientGoalWarnings,
        type SmartWarning,
    } from "$lib/utils/mix/warnings/smartWarnings";
    import {
        cacheSmoothieListLocally,
		preserveSelectedListItems,
        readSmoothieList,
        SMOOTHIE_LISTS_CHANGED_EVENT,
    } from "$lib/utils/storage/client/smoothieLists";
    import {
        readCloudMixPreferences,
        reconcileCloudSmoothieList,
        saveCloudMixPreferences,
    } from "$lib/utils/storage/supabase";
    import IngredientContributionBreakdown from "$lib/components/mix/insights/IngredientContributionBreakdown.svelte";
    import {
        clearLoadedSavedDrink,
        readLoadedSavedDrink,
        saveExistingSavedDrink,
        saveNewSavedDrink,
        writeLoadedSavedDrink,
        type LoadedSavedDrink,
        type SavedDrinkInput,
    } from "$lib/utils/storage/client/savedDrinks";
	import {
		formatChartNumber,
		getDefaultNutrientOptions,
		getEstimatedVolumeWarnings,
		getFoodSourceLabel,
		getNutrientMeta,
		type NutrientOption,
		type SaveGoalDiff,
		withOverageDetails,
	} from "$lib/utils/mix/ui/mixUi";
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
		readStoredNutrientGoals,
		writeStoredMixState,
		writeStoredRawMixState,
		writeStoredNutrientGoals,
		type MixStateSnapshot,
	} from "$lib/utils/mix/state/mixState";
    import {
        getChartColors,
        getChartValues,
        getDefaultNutrientGoal,
        getGoalValues,
        getNutrientContributionBreakdowns,
        getNutrientChartMetrics,
        getNutrientContributors as calculateNutrientContributors,
        getNutrientFoodSuggestions,
        getNutrientReductionSuggestions,
        getPointColors,
        getNutrientProgress,
        getNutrientTotal as calculateNutrientTotal,
    } from "$lib/utils/mix/calculations";
    import type { FdcFood } from "$lib/utils/food/types";
    import { onMount } from "svelte";
    import {
        DEFAULT_NUTRIENT_GOALS,
        GOAL_TEMPLATES,
        MIX_STORAGE_KEYS,
    } from "../../defaults/mixDefaults";
    import { POINT_SHAPE_DEFAULTS } from "../../defaults/pointShapeDefaults";
	import type { ServingMeasureUnit } from "../../defaults/servingMeasureDefaults";
	import { vitalNutrients } from "../../variables/vitalNutrients";
	import { ALL_NUTRIENTS } from "../../variables/allNutrients";

	type ResetAction = "goals" | "ingredients" | "all";

    let selected = $state<(string | number)[]>(vitalNutrients.map((n) => n.id));
	let pendingResetAction = $state<ResetAction | null>(null);
    let options = $state<NutrientOption[]>(getDefaultNutrientOptions());
    let fridgeItems = $state<FdcFood[]>([]);
    let shoppingItems = $state<FdcFood[]>([]);
    let selectedFoodIds = $state<number[]>([]);
    let servingGrams = $state<Record<number, number>>({});
    let servingQuantities = $state<Record<number, number>>({});
    let servingUnits = $state<Record<number, ServingMeasureUnit>>({});
    let nutrientGoals = $state<Record<number, number>>({
        ...DEFAULT_NUTRIENT_GOALS,
    });
    let saveDialogOpen = $state(false);
    let selectedGoalTemplateId = $state("");
    let loadedSavedDrink = $state<LoadedSavedDrink | null>(null);
    let saveDialogError = $state("");
    let saveDialogBusy = $state(false);
	const foodPreferenceContext = getFoodPreferenceContext();

	const assignMixState = (state: MixStateSnapshot) => {
		selected = state.selected;
		options = state.options;
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

    const setLoadedSavedDrink = (drink: LoadedSavedDrink | null) => {
        loadedSavedDrink = drink;
        if (drink) {
            writeLoadedSavedDrink(drink);
            return;
        }

        clearLoadedSavedDrink();
    };

    const markLoadedSavedDrinkDirty = () => {
        if (!loadedSavedDrink || loadedSavedDrink.isDirty) return;
        setLoadedSavedDrink({ ...loadedSavedDrink, isDirty: true });
    };

    const detachLoadedSavedDrink = () => {
        setLoadedSavedDrink(null);
    };

    const getServingQuantity = (food: FdcFood) => {
        return getServingQuantityFromState(food, servingQuantities);
    };

    const getServingUnit = (food: FdcFood) => {
        return getServingUnitFromState(food, servingUnits);
    };

    const getServingConversion = (food: FdcFood) => {
        return getServingConversionFromState(food, servingQuantities, servingUnits);
    };

    const selectedCount = $derived(selected.length);
    const selectedNutrients = $derived(
        selected.flatMap((id) => {
            const nutrient = getNutrientMeta(id, [
                vitalNutrients,
                ALL_NUTRIENTS,
            ]);
            return nutrient ? [nutrient] : [];
        }),
    );
    const allIngredientItems = $derived([...fridgeItems, ...shoppingItems]);
    const selectedFoods = $derived(
        allIngredientItems.filter((item) =>
            selectedFoodIds.includes(item.fdcId),
        ),
    );
    const canSaveCurrentMix = $derived(
        selectedFoods.length > 0 &&
            (!loadedSavedDrink || loadedSavedDrink.isDirty),
    );
	const hasCustomGoals = $derived.by(() => {
		const goalIds = new Set([
			...Object.keys(DEFAULT_NUTRIENT_GOALS),
			...Object.keys(nutrientGoals),
		]);
		return [...goalIds].some(
			(id) => nutrientGoals[Number(id)] !== DEFAULT_NUTRIENT_GOALS[Number(id)],
		);
	});
	const hasCustomNutrientSelection = $derived.by(() => {
		const defaultIds = vitalNutrients.map((nutrient) => String(nutrient.id));
		return (
			selected.length !== defaultIds.length ||
			selected.some((id, index) => String(id) !== defaultIds[index])
		);
	});
	const hasResettableMixState = $derived(
		hasCustomGoals || hasCustomNutrientSelection || selectedFoodIds.length > 0,
	);
    const nutrientProgress = $derived(
        getNutrientProgress(
            selectedNutrients,
            selectedFoods,
            nutrientGoals,
            servingGrams,
        ),
    );
    const nutrientChartMetrics = $derived(
        getNutrientChartMetrics(
            selectedNutrients,
            selectedFoods,
            nutrientGoals,
            servingGrams,
        ),
    );
    const chartValues = $derived(getChartValues(nutrientChartMetrics));
    const nutrientLabels = $derived(
        selectedNutrients.map((nutrient) =>
            (nutrient.label ?? String(nutrient.id)).replace("Total ", ""),
        ),
    );
    const nutrientValueLabels = $derived(
        selectedNutrients.map((nutrient) => {
            const nutrientId = Number(nutrient.id);
            const total = getNutrientTotal(nutrientId);
            const goal =
                nutrientGoals[nutrientId] ?? getDefaultNutrientGoal(nutrient);
            return `${formatChartNumber(total)}/${formatChartNumber(goal)}${nutrient.unit ?? ""}`;
        }),
    );
    const saveGoalDiffs = $derived<SaveGoalDiff[]>(
        selectedNutrients.map((nutrient) => {
            const nutrientId = Number(nutrient.id);
            const total = getNutrientTotal(nutrientId);
            const goal =
                nutrientGoals[nutrientId] ?? getDefaultNutrientGoal(nutrient);
            const difference = total - goal;
            const tolerance = Math.max(goal * 0.05, 0.05);
            const status =
                Math.abs(difference) <= tolerance
                    ? "near"
                    : difference > 0
                      ? "over"
                      : "under";

            return {
                label: nutrient.label ?? String(nutrient.id),
                unit: nutrient.unit ?? "",
                total,
                goal,
                difference,
                percentOfGoal: goal > 0 ? (total / goal) * 100 : 0,
                status,
            };
        }),
    );
    const goalValues = $derived(getGoalValues(nutrientChartMetrics));
    const contributionBreakdowns = $derived(
        getNutrientContributionBreakdowns(
            selectedNutrients,
            selectedFoods,
            servingGrams,
        ),
    );
    const nutrientFoodSuggestions = $derived(
        getNutrientFoodSuggestions({
            nutrients: selectedNutrients,
            availableFoods: allIngredientItems,
            selectedFoodIds,
            nutrientGoals,
            servingGrams,
            sourceLabelForFood: (food) => getFoodSourceLabel(food, fridgeItems),
        }),
    );
    const nutrientReductionSuggestions = $derived(
        getNutrientReductionSuggestions({
            nutrients: selectedNutrients,
            selectedFoods,
            nutrientGoals,
            servingGrams,
            sourceLabelForFood: (food) => getFoodSourceLabel(food, fridgeItems),
        }),
    );
    const nutrientOverages = $derived(
        selectedNutrients.flatMap((nutrient) => {
            const goal =
                nutrientGoals[Number(nutrient.id)] ||
                getDefaultNutrientGoal(nutrient);
            const nutrientId = Number(nutrient.id);
            const total = getNutrientTotal(nutrientId);
            if (goal <= 0 || total <= goal) return [];

            return [
                {
                    nutrientId,
                    label: nutrient.label ?? String(nutrient.id),
                    unit: nutrient.unit ?? "",
                    total,
                    goal,
                    overage: total - goal,
                    contributors: getNutrientContributors(nutrientId),
                },
            ];
        }),
    );
    const smartWarnings = $derived<SmartWarning[]>([
        ...getNutrientGoalWarnings(
            selectedNutrients.map((nutrient) => {
                const nutrientId = Number(nutrient.id);
                return {
                    id: nutrient.id,
                    label: nutrient.label ?? String(nutrient.id),
                    unit: nutrient.unit ?? "",
                    total: getNutrientTotal(nutrientId),
                    goal:
                        nutrientGoals[nutrientId] ??
                        getDefaultNutrientGoal(nutrient),
                };
            }),
            { includeUnderTargets: selectedFoods.length > 0 },
        ).map((warning) => withOverageDetails(warning, nutrientOverages)),
		...getEstimatedVolumeWarnings(selectedFoods, getServingConversion),
		...getFoodPreferenceSmartWarnings(
			selectedFoods,
			foodPreferenceContext.current,
		),
    ]);
    const maxNutrientProgress = $derived(
        nutrientProgress.reduce((max, progress) => Math.max(max, progress), 0),
    );
    const chartColors = $derived(getChartColors(maxNutrientProgress));
    const pointColors = $derived(getPointColors(nutrientProgress));

    const getNutrientTotal = (nutrientId: number) => {
        return calculateNutrientTotal(selectedFoods, nutrientId, servingGrams);
    };

    const getNutrientContributors = (nutrientId: number) => {
        return calculateNutrientContributors(
            selectedFoods,
            nutrientId,
            servingGrams,
        );
    };

    const loadIngredientLists = () => {
        fridgeItems = readSmoothieList(MIX_STORAGE_KEYS.fridge);
        shoppingItems = readSmoothieList(MIX_STORAGE_KEYS.shoppingList);
    };

    const loadCloudBackedIngredientLists = async () => {
        const localFridge = readSmoothieList(MIX_STORAGE_KEYS.fridge);
        const localShoppingList = readSmoothieList(MIX_STORAGE_KEYS.shoppingList);

        fridgeItems = localFridge;
        shoppingItems = localShoppingList;

        const [nextFridge, nextShoppingList] = await Promise.all([
            reconcileCloudSmoothieList(MIX_STORAGE_KEYS.fridge, localFridge),
            reconcileCloudSmoothieList(
                MIX_STORAGE_KEYS.shoppingList,
                localShoppingList,
            ),
        ]);

		const preservedFridge = preserveSelectedListItems(
			nextFridge,
			localFridge,
			selectedFoodIds,
		);
		const preservedShoppingList = preserveSelectedListItems(
			nextShoppingList,
			localShoppingList,
			selectedFoodIds,
		);

        fridgeItems = preservedFridge;
        shoppingItems = preservedShoppingList;
        cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, preservedFridge);
		cacheSmoothieListLocally(
			MIX_STORAGE_KEYS.shoppingList,
			preservedShoppingList,
		);
    };

    const loadNutrientGoals = () => {
        nutrientGoals = readStoredNutrientGoals();
    };

    const saveNutrientGoals = (nextGoals: Record<number, number>) => {
        writeStoredNutrientGoals(nextGoals);
        void saveCloudMixPreferences({ nutrientGoals: nextGoals });
    };

    const loadMixState = () => {
        assignMixState(readStoredMixState(getCurrentMixState(), allIngredientItems));
    };

    const saveMixState = () => {
        const mixState = getCurrentMixState();
        writeStoredMixState(mixState);
        void saveCloudMixPreferences({ mixState });
    };

    const loadCloudBackedMixPreferences = async () => {
        const cloudPreferences = await readCloudMixPreferences();
        if (!cloudPreferences) return;

        const hasCloudGoals =
            cloudPreferences.nutrientGoals &&
            Object.keys(cloudPreferences.nutrientGoals).length > 0;
        const hasCloudMixState =
            cloudPreferences.mixState &&
            Object.keys(cloudPreferences.mixState).length > 0;

        if (hasCloudGoals) {
            writeStoredNutrientGoals(cloudPreferences.nutrientGoals ?? {});
            loadNutrientGoals();
        }

        if (hasCloudMixState) {
            writeStoredRawMixState(cloudPreferences.mixState ?? {});
            loadMixState();
        }

    };

    const resetGoals = () => {
        detachLoadedSavedDrink();
        nutrientGoals = { ...DEFAULT_NUTRIENT_GOALS };
        selectedGoalTemplateId = "";
        saveNutrientGoals(nutrientGoals);
    };

    const clearIngredients = () => {
        detachLoadedSavedDrink();
        selectedFoodIds = [];
		const emptyServingState = getEmptyServingState();
        servingGrams = emptyServingState.servingGrams;
        servingQuantities = emptyServingState.servingQuantities;
        servingUnits = emptyServingState.servingUnits;
        saveMixState();
    };

    const resetMix = () => {
		detachLoadedSavedDrink();
		assignMixState(getDefaultMixState());
        nutrientGoals = { ...DEFAULT_NUTRIENT_GOALS };
        selectedGoalTemplateId = "";
        saveNutrientGoals(nutrientGoals);
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
				description: "Remove every selected ingredient and its entered amount from this draft?",
				confirmLabel: "Clear ingredients",
			};
		}
		return {
			title: "Reset the entire mix?",
			description: "Restore default nutrients and goals, and remove all selected ingredients?",
			confirmLabel: "Reset all",
		};
	});

	const confirmReset = () => {
		if (pendingResetAction === "goals") resetGoals();
		if (pendingResetAction === "ingredients") clearIngredients();
		if (pendingResetAction === "all") resetMix();
		pendingResetAction = null;
	};

    const getCurrentSavedDrinkInput = (name: string): SavedDrinkInput => {
        return {
            name,
            foods: selectedFoods,
            selected,
            options,
            nutrientGoals,
            servingGrams,
            servingQuantities,
            servingUnits,
        };
    };

    const getSaveErrorMessage = (reason: "duplicate" | "missing" | "unavailable") => {
        if (reason === "duplicate") {
            return "You already have a saved drink with this name. Choose a different name.";
        }
        if (reason === "missing") {
            return "This saved drink no longer exists. Save it as a new drink instead.";
        }
        return "The drink could not be saved right now. Check your connection and try again.";
    };

    const validateSaveName = (name: string) => {
        if (name.trim()) return true;
        saveDialogError = "Enter a name for this drink.";
        return false;
    };

    const saveCurrentDrinkAsNew = async (name: string) => {
        if (!validateSaveName(name)) return;

        saveDialogBusy = true;
        saveDialogError = "";
        const result = await saveNewSavedDrink(getCurrentSavedDrinkInput(name));
        saveDialogBusy = false;
        if (!result.ok) {
            saveDialogError = getSaveErrorMessage(result.reason);
            return;
        }

        const { drink } = result;
        setLoadedSavedDrink({
            id: drink.id,
            name: drink.name,
            isDirty: false,
        });
        saveDialogOpen = false;
    };

    const overwriteLoadedDrink = async (name: string) => {
        if (!loadedSavedDrink) return;
        if (!validateSaveName(name)) return;

        saveDialogBusy = true;
        saveDialogError = "";
        const result = await saveExistingSavedDrink(
            loadedSavedDrink.id,
            getCurrentSavedDrinkInput(name),
        );
        saveDialogBusy = false;
        if (!result.ok) {
            saveDialogError = getSaveErrorMessage(result.reason);
            return;
        }

        const { drink } = result;
        setLoadedSavedDrink({
            id: drink.id,
            name: drink.name,
            isDirty: false,
        });
        saveDialogOpen = false;
    };

    const handleChange = (next: (string | number)[]) => {
        selected = next;
        markLoadedSavedDrinkDirty();
        saveMixState();
    };

    const handleAddNutrient = (nutrientId: string | number) => {
        const nutrient = ALL_NUTRIENTS.find((n) => n.id == nutrientId);
        if (nutrient && !options.some((opt) => opt.id == nutrient.id)) {
            options = [...options, { id: nutrient.id, label: nutrient.label }];
			selected = [...selected, nutrient.id];
            markLoadedSavedDrinkDirty();
            saveMixState();
        }
    };

    const updateGoal = (id: string | number, value: string) => {
        const nextGoals = {
            ...nutrientGoals,
            [Number(id)]: Math.max(0, Number(value) || 0),
        };
        nutrientGoals = nextGoals;
        markLoadedSavedDrinkDirty();
        saveNutrientGoals(nextGoals);
        selectedGoalTemplateId = "";
    };

    const updateGoalTemplateSelection = (templateId: string) => {
        selectedGoalTemplateId = templateId;
    };

    const applyGoalTemplate = () => {
        const template = GOAL_TEMPLATES.find(
            (item) => item.id === selectedGoalTemplateId,
        );
        if (!template) return;

        const nextGoals = {
            ...nutrientGoals,
            ...template.goals,
        };
        nutrientGoals = nextGoals;
        markLoadedSavedDrinkDirty();
        saveNutrientGoals(nextGoals);
    };

    const toggleFood = (foodId: number) => {
		assignMixState(
			getStateWithToggledFood(getCurrentMixState(), foodId, allIngredientItems),
		);
        markLoadedSavedDrinkDirty();
        saveMixState();
    };

    const addSuggestedFood = (foodId: number, nextServingGrams: number) => {
		assignMixState(
			getStateWithGramServing(
				getCurrentMixState(),
				foodId,
				nextServingGrams,
				true,
			),
		);
        markLoadedSavedDrinkDirty();
        saveMixState();
    };

    const applySuggestedReduction = (
        foodId: number,
        nextServingGrams: number,
    ) => {
		assignMixState(
			getStateWithGramServing(
				getCurrentMixState(),
				foodId,
				nextServingGrams,
			),
		);
        markLoadedSavedDrinkDirty();
        saveMixState();
    };

    const getServingConversionWarning = (food: FdcFood) => {
        return getServingConversion(food).warning;
    };

    const updateServingAmount = (
        food: FdcFood,
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
        markLoadedSavedDrinkDirty();
        saveMixState();
    };

    onMount(() => {
        const restoredSavedDrink = readLoadedSavedDrink();
        loadedSavedDrink = restoredSavedDrink;
        void loadCloudBackedIngredientLists();
        loadMixState();
        loadNutrientGoals();
        if (!restoredSavedDrink) void loadCloudBackedMixPreferences();
        window.addEventListener("storage", loadIngredientLists);
        window.addEventListener(
            SMOOTHIE_LISTS_CHANGED_EVENT,
            loadIngredientLists,
        );
        window.addEventListener("focus", loadIngredientLists);
        return () => {
            window.removeEventListener("storage", loadIngredientLists);
            window.removeEventListener(
                SMOOTHIE_LISTS_CHANGED_EVENT,
                loadIngredientLists,
            );
            window.removeEventListener("focus", loadIngredientLists);
        };
    });
</script>

<div class="mix-page">
	<ConfirmationDialog
		open={pendingResetAction !== null}
		title={resetDialogContent.title}
		description={resetDialogContent.description}
		confirmLabel={resetDialogContent.confirmLabel}
		danger
		onConfirm={confirmReset}
		onCancel={() => (pendingResetAction = null)}
	/>
    <header class="mix-header">
        <div>
            {#if loadedSavedDrink}
                <p class="mix-header__eyebrow">Loaded saved mix</p>
                <div class="mix-header__title-row">
                    <h2>{loadedSavedDrink.name}</h2>
                    {#if loadedSavedDrink.isDirty}
                        <span>Unsaved changes</span>
                    {/if}
                </div>
                <p>
                    {loadedSavedDrink.isDirty
                        ? "Your saved mix has not changed. Save when this draft is ready."
                        : "Adjust this draft, then overwrite it or save a new copy."}
                </p>
            {:else}
                <h2>Mix</h2>
                <p>Build your smoothie here.</p>
            {/if}
        </div>
        <div class="reset-actions" aria-label="Mix reset actions">
            <button
                class="primary-save-action"
                type="button"
                onclick={() => {
                    saveDialogError = "";
                    saveDialogOpen = true;
                }}
                disabled={!canSaveCurrentMix}
            >{loadedSavedDrink ? "Save Changes" : "Save"}</button
            >
            <button type="button" onclick={() => (pendingResetAction = "goals")} disabled={!hasCustomGoals}>Reset Goals</button>
            <button type="button" onclick={() => (pendingResetAction = "ingredients")} disabled={selectedFoodIds.length === 0}
                >Clear Ingredients</button
            >
            <button type="button" onclick={() => (pendingResetAction = "all")} disabled={!hasResettableMixState}>Reset All</button>
        </div>
    </header>

    <TextInputDialog
        open={saveDialogOpen}
        title="Review & Save Drink"
        description="Before saving, confirm these totals are close enough to your goals."
        label="Drink name"
        placeholder="Post-workout, Low sugar, High fiber…"
        initialValue={loadedSavedDrink?.name ?? ""}
        error={saveDialogError}
        busy={saveDialogBusy}
        confirmLabel={loadedSavedDrink ? "Overwrite Existing" : "Save Drink"}
        secondaryConfirmLabel={loadedSavedDrink ? "Save as New" : ""}
        cancelLabel="Cancel"
        onConfirm={loadedSavedDrink ? overwriteLoadedDrink : saveCurrentDrinkAsNew}
        onSecondaryConfirm={loadedSavedDrink ? saveCurrentDrinkAsNew : undefined}
        onValueChange={() => (saveDialogError = "")}
        onCancel={() => {
            saveDialogError = "";
            saveDialogOpen = false;
        }}
    >
        <SaveGoalReview diffs={saveGoalDiffs} />
    </TextInputDialog>

    <section class="mix-panel" aria-labelledby="nutrient-controls-title">
        <div class="mix-builder">
            <NutrientSelector
                {options}
                {selected}
                {selectedCount}
                onChange={handleChange}
                onAddNutrient={handleAddNutrient}
            />

            <GoalTargets
                {selectedNutrients}
                {nutrientGoals}
                {selectedGoalTemplateId}
                onTemplateChange={updateGoalTemplateSelection}
                onApplyTemplate={applyGoalTemplate}
                onUpdateGoal={updateGoal}
                getGoal={getDefaultNutrientGoal}
                getTotal={getNutrientTotal}
            />

            <IngredientChooser
                {fridgeItems}
                {shoppingItems}
                {selectedFoodIds}
                onToggleFood={toggleFood}
            />

            {#if selectedFoods.length > 0}
                <SelectedIngredientsPanel
                    {selectedFoods}
                    {fridgeItems}
                    {selectedNutrients}
                    {servingGrams}
                    {getServingQuantity}
                    {getServingUnit}
                    {getServingConversion}
                    {getServingConversionWarning}
                    onRemove={toggleFood}
                    onServingChange={updateServingAmount}
                />
            {:else}
                <MixEmptyState />
            {/if}

            <div class="shape-panel" aria-label="Generated shape">
                <div class="shape-preview">
                    <PointShape
                        points={selectedCount}
                        values={chartValues}
                        {goalValues}
                        labels={nutrientLabels}
                        valueLabels={nutrientValueLabels}
                        {pointColors}
                        fillColor={chartColors.fill}
                        strokeColor={chartColors.stroke}
                        size={POINT_SHAPE_DEFAULTS.size}
                        fullWidth
                    />
                </div>
                <SmartWarnings warnings={smartWarnings} />
                <NutrientAdjustmentSuggestions
                    foodSuggestions={nutrientFoodSuggestions}
                    reductionSuggestions={nutrientReductionSuggestions}
                    onAdd={addSuggestedFood}
                    onReduce={applySuggestedReduction}
                />
                <IngredientContributionBreakdown
                    breakdowns={contributionBreakdowns}
                />
            </div>

        </div>
    </section>
</div>

<style lang="scss">
    @use "../../styles/variables" as *;

    .mix-page {
        max-width: $app-max-width;
        margin: 0 auto;
        padding: $app-gap-sm 0;
        box-sizing: border-box;
    }

    .mix-header {
        display: flex;
        justify-content: space-between;
        gap: $app-gap-md;
        align-items: flex-start;
        margin-bottom: $app-gap-md;

        h2 {
            margin-bottom: 0.18rem;
            color: $app-primary;
            font-size: $app-font-size-xl;
            font-weight: 800;
        }

        p {
            color: $app-muted;
            font-size: $app-font-size-md;
        }
    }

    .mix-header .mix-header__eyebrow {
        margin-bottom: 0.12rem;
        color: $app-warning-strong;
        font-size: $app-font-size-xs;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }

    .mix-header__title-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        align-items: center;
        margin-bottom: 0.18rem;

        h2 {
            min-width: 0;
            margin-bottom: 0;
            overflow-wrap: anywhere;
        }

        span {
            padding: 0.14rem 0.42rem;
            color: $app-warning-strong;
            background: $app-warning-bg;
            border-radius: $app-radius-pill;
            font-size: $app-font-size-xs;
            font-weight: 900;
            white-space: nowrap;
        }
    }

    .reset-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.35rem;
        max-width: 22rem;

        button {
            background: $app-btn-bg;
            color: $app-btn-text;
            border-radius: $app-radius;
            font-size: $app-font-size-sm;
            font-weight: $app-button-font-weight;
            line-height: $app-button-line-height;
            padding: 0.38rem 0.65rem;

            &:hover {
                background: $app-btn-bg-hover;
            }

            &:disabled {
                cursor: not-allowed;
                background: $app-btn-disabled;
            }
        }

        .primary-save-action:not(:disabled) {
            color: $app-highlight-text;
            background: $app-highlight;

            &:hover {
                background: $app-highlight-hover;
            }
        }
    }

    .mix-panel {
        padding: $app-gap-sm;
        background: $app-section-bg;
        border: $app-border;
        border-radius: $app-card-radius;
    }

    .mix-builder {
        display: grid;
        grid-template-columns: 1fr;
        align-items: stretch;
        gap: $app-gap-sm;
    }

    .shape-panel {
        display: grid;
        place-items: center;
        padding: $app-gap-sm;
        background: $app-bg;
        border: $app-border;
        border-radius: $app-card-radius;
    }

    .shape-preview {
        display: grid;
        place-items: center;
        width: 100%;
        background: $app-section-bg;
        border-radius: $app-card-radius;
    }

    @media (max-width: $app-breakpoint-md) {
        .mix-page {
            padding-top: $app-gap-sm;
        }

        .mix-header {
            display: grid;
        }

        .reset-actions {
            justify-content: flex-start;
        }

    }
</style>
