<script lang="ts">
	import "./styles/mixPage.scss";
	import PillButton from "$lib/components/common/buttons/PillButton.svelte";
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
	import StatusMessage from "$lib/components/common/feedback/StatusMessage.svelte";
	import { getFoodPreferenceContext } from "$lib/utils/profile/foodPreferenceContext.svelte";
    import {
		getFoodPreferenceSmartWarnings,
		getIncompleteNutrientDataWarnings,
        getNutrientGoalWarnings,
        type SmartWarning,
    } from "$lib/utils/mix/warnings/smartWarnings";
    import {
		preserveSelectedListItems,
        SMOOTHIE_LISTS_CHANGED_EVENT,
    } from "$lib/utils/storage/client/smoothieLists";
    import {
		readCloudSmoothieList,
        readCloudMixPreferences,
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
		getNutrientTotalResult,
    } from "$lib/utils/mix/calculations";
    import type { FdcFood } from "$lib/utils/food/types";
    import { onMount } from "svelte";
    import { MIX_STORAGE_KEYS } from "../../defaults/mixDefaults";
    import { POINT_SHAPE_DEFAULTS } from "../../defaults/pointShapeDefaults";
	import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
	import {
		getDefaultMixFields,
		getDefaultMixGoals,
		getMixGoalTemplates,
		getNutrientCatalog,
	} from "$lib/utils/food/reference/appReferenceCatalog";
	import type { MixResetAction } from "./types";

	const defaultMixFields = getDefaultMixFields();
	const nutrientCatalog = getNutrientCatalog();
	const defaultNutrientGoals = getDefaultMixGoals();
	const goalTemplates = getMixGoalTemplates();

    let selected = $state<(string | number)[]>(defaultMixFields.map((n) => n.id));
	let pendingResetAction = $state<MixResetAction | null>(null);
    let options = $state<NutrientOption[]>(getDefaultNutrientOptions());
    let fridgeItems = $state<FdcFood[]>([]);
    let shoppingItems = $state<FdcFood[]>([]);
    let selectedFoodIds = $state<number[]>([]);
    let servingGrams = $state<Record<number, number>>({});
    let servingQuantities = $state<Record<number, number>>({});
    let servingUnits = $state<Record<number, ServingMeasureUnit>>({});
    let nutrientGoals = $state<Record<number, number>>({
		...defaultNutrientGoals,
    });
    let saveDialogOpen = $state(false);
    let selectedGoalTemplateId = $state("");
    let loadedSavedDrink = $state<LoadedSavedDrink | null>(null);
    let saveDialogError = $state("");
    let saveDialogBusy = $state(false);
	let cloudLoadError = $state("");
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
				defaultMixFields,
				nutrientCatalog,
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
			...Object.keys(defaultNutrientGoals),
			...Object.keys(nutrientGoals),
		]);
		return [...goalIds].some(
			(id) => nutrientGoals[Number(id)] !== defaultNutrientGoals[Number(id)],
		);
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
    const nutrientCoverage = $derived(
		selectedNutrients.map((nutrient) => {
			const result = getNutrientTotalResult(
				selectedFoods,
				Number(nutrient.id),
				servingGrams,
			);
			return {
				id: nutrient.id,
				label: nutrient.label ?? String(nutrient.id),
				total: result.total,
				missingFoods: result.missingFoodIds.flatMap((foodId) => {
					const food = selectedFoods.find((item) => item.fdcId === foodId);
					return food ? [food.description] : [];
				}),
			};
		}),
	);
    const smartWarnings = $derived<SmartWarning[]>([
		...getIncompleteNutrientDataWarnings(nutrientCoverage),
        ...getNutrientGoalWarnings(
            selectedNutrients.map((nutrient) => {
                const nutrientId = Number(nutrient.id);
                return {
                    id: nutrient.id,
                    label: nutrient.label ?? String(nutrient.id),
                    unit: nutrient.unit ?? "",
					total: getNutrientTotal(nutrientId),
					complete:
						nutrientCoverage.find((coverage) => coverage.id == nutrient.id)
							?.missingFoods.length === 0,
                    goal:
                        nutrientGoals[nutrientId] ??
                        getDefaultNutrientGoal(nutrient),
                };
            }),
            { includeUnderTargets: selectedFoods.length > 0 },
        ).map((warning) => withOverageDetails(warning, nutrientOverages)),
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

    const loadCloudBackedIngredientLists = async () => {
		const loadedFridge = fridgeItems;
		const loadedShoppingList = shoppingItems;

		try {
			const [nextFridge, nextShoppingList] = await Promise.all([
				readCloudSmoothieList(MIX_STORAGE_KEYS.fridge),
				readCloudSmoothieList(MIX_STORAGE_KEYS.shoppingList),
			]);
			if (!nextFridge || !nextShoppingList) {
				throw new Error("Saved ingredient lists are unavailable.");
			}

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
		nutrientGoals = { ...defaultNutrientGoals };
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
		nutrientGoals = { ...defaultNutrientGoals };
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
		const nutrient = nutrientCatalog.find((n) => n.id == nutrientId);
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
		const template = goalTemplates.find(
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
		window.addEventListener(
            SMOOTHIE_LISTS_CHANGED_EVENT,
            loadIngredientLists,
        );
        window.addEventListener("focus", loadIngredientLists);
        return () => {
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
			<PillButton
				variant="primary"
				onclick={() => {
					saveDialogError = "";
					saveDialogOpen = true;
				}}
				disabled={!canSaveCurrentMix}
			>
				{loadedSavedDrink ? "Save Changes" : "Save"}
			</PillButton>
			<PillButton onclick={() => (pendingResetAction = "goals")} disabled={!hasCustomGoals}>
				Reset Goals
			</PillButton>
			<PillButton onclick={() => (pendingResetAction = "ingredients")} disabled={selectedFoodIds.length === 0}>
				Clear Ingredients
			</PillButton>
			<PillButton onclick={() => (pendingResetAction = "all")} disabled={!hasResettableMixState}>
				Reset All
			</PillButton>
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

	{#if cloudLoadError}
		<StatusMessage tone="danger" title="Database lists unavailable">
			{cloudLoadError}
		</StatusMessage>
	{/if}

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
