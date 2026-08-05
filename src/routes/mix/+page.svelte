<script lang="ts">
	import {
		pushState,
		replaceState as replaceNavigationState,
	} from "$app/navigation";
	import { page } from "$app/state";
	import GoalTargets from "$lib/components/mix/controls/GoalTargets/GoalTargets.svelte";
	import IngredientChooser from "$lib/components/mix/ingredients/IngredientChooser/IngredientChooser.svelte";
	import NutrientAdjustmentSuggestions from "$lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte";
	import MixHeader from "$lib/components/mix/layout/MixHeader/MixHeader.svelte";
	import MixOptionsSheet from "$lib/components/mix/layout/MixOptionsSheet/MixOptionsSheet.svelte";
	import MixSectionOrganizer from "$lib/components/mix/layout/MixSectionOrganizer/MixSectionOrganizer.svelte";
	import NutrientShapePanel from "$lib/components/mix/insights/NutrientShapePanel/NutrientShapePanel.svelte";
	import SaveGoalReview from "$lib/components/mix/save/SaveGoalReview/SaveGoalReview.svelte";
	import SelectedIngredientsPanel from "$lib/components/mix/ingredients/SelectedIngredientsPanel/SelectedIngredientsPanel.svelte";
	import SmartWarnings from "$lib/components/mix/insights/SmartWarnings/SmartWarnings.svelte";
	import TextInputDialog from "$lib/components/common/dialogs/TextInputDialog/TextInputDialog.svelte";
	import ConfirmationDialog from "$lib/components/common/dialogs/ConfirmationDialog/ConfirmationDialog.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ViewBody from "$lib/components/common/view/ViewBody/ViewBody.svelte";
	import ViewFrame from "$lib/components/common/view/ViewFrame/ViewFrame.svelte";
	import ViewTop from "$lib/components/common/view/ViewTop/ViewTop.svelte";
	import {
		getFoodPreferenceSmartWarnings,
		getNutrientGoalWarnings,
        type SmartWarning,
    } from "$lib/utils/mix/warnings/smartWarnings";
    import {
		preserveSelectedListItems,
        SMOOTHIE_LISTS_CHANGED_EVENT,
    } from "$lib/utils/storage/client/smoothieLists";
	    import {
	        saveCloudMixPreferences,
	        saveCloudMixSectionDisclosureState,
	        saveCloudMixSectionOrder,
	    } from "$lib/utils/storage/supabase";
	import { readIngredientList } from "$lib/utils/ingredients/ingredientListApi";
    import IngredientContributionBreakdown from "$lib/components/mix/insights/IngredientContributionBreakdown/IngredientContributionBreakdown.svelte";
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
        getNutrientAdjustmentSuggestions,
        getPointColors,
		getNutrientProgress,
		getNutrientTotal as calculateNutrientTotal,
	} from "$lib/utils/mix/calculations";
    import type { FdcFood } from "$lib/utils/food/types";
    import { onMount } from "svelte";
    import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
	import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
	import {
		createScrollDirectionTracker,
	} from "$lib/utils/navigation/scrollDirection";
	import {
		getDefaultMixFields,
		getDefaultMixGoals,
		getMixGoalTemplates,
		getNutrientCatalog,
	} from "$lib/utils/food/reference/appReferenceCatalog";
	import type { MixResetAction } from "./types";
	import {
		buildMixRouteHref,
		getActiveMixRouteHref,
		getActiveMixRouteState,
		MIX_ROUTE_OVERLAYS,
		type MixRouteTarget,
	} from "$lib/utils/mix/navigation/mixRouteState";
	import {
		normalizeMixSectionDisclosureState,
		normalizeMixSectionOrder,
		type MixSectionDisclosureState,
		type MixSectionId,
	} from "$lib/utils/mix/ui/mixSectionOrder";

	const defaultMixFields = getDefaultMixFields();
	const nutrientCatalog = getNutrientCatalog();
	const defaultNutrientGoals = getDefaultMixGoals();
	const goalTemplates = getMixGoalTemplates();
	const initialMixData = page.data.mixData;

    let selected = $state<(string | number)[]>(defaultMixFields.map((n) => n.id));
	let options = $state<NutrientOption[]>(getDefaultNutrientOptions());
    let fridgeItems = $state<FdcFood[]>(initialMixData?.fridge ?? []);
    let shoppingItems = $state<FdcFood[]>(initialMixData?.shoppingList ?? []);
    let selectedFoodIds = $state<number[]>([]);
    let servingGrams = $state<Record<number, number>>({});
    let servingQuantities = $state<Record<number, number>>({});
    let servingUnits = $state<Record<number, ServingMeasureUnit>>({});
    let nutrientGoals = $state<Record<number, number>>({
		...defaultNutrientGoals,
    });
	let selectedGoalTemplateId = $state("");
    let loadedSavedDrink = $state<LoadedSavedDrink | null>(null);
    let saveDialogError = $state("");
    let saveDialogBusy = $state(false);
	let cloudLoadError = $state(initialMixData?.loadError ?? "");
	let sectionOrder = $state<MixSectionId[]>(
		normalizeMixSectionOrder(initialMixData?.preferences.sectionOrder),
	);
	let sectionDisclosureState = $state<MixSectionDisclosureState>(
		normalizeMixSectionDisclosureState(
			initialMixData?.preferences.sectionDisclosureState,
		),
	);
	let sectionOrderSaveBusy = $state(false);
	let sectionOrderSaveError = $state("");
	let sectionDisclosureSaveError = $state("");
	let sectionOrderSaveCount = 0;
	let sectionOrderSaveQueue: Promise<boolean> = Promise.resolve(true);
	let sectionDisclosureSaveQueue: Promise<boolean> = Promise.resolve(true);
	let mixStateReady = $state(false);
	let compactTopHidden = $state(false);
	let mixScrollContainer = $state<HTMLElement | null>(null);
	const mixPageScrollDirectionTracker = createScrollDirectionTracker();
	let mixScrollResumeFrame: number | null = null;
	let mixScrollSettleFrame: number | null = null;
	let compactHeaderLayoutSettling = false;
	const activeMixRouteHref = $derived(
		getActiveMixRouteHref(page.url, page.state.mixRouteHref),
	);
	const mixRouteState = $derived(
		getActiveMixRouteState(page.url, page.state.mixRouteHref),
	);
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

	const queueSectionOrderSave = (nextOrder: MixSectionId[]) => {
		const normalizedOrder = normalizeMixSectionOrder(nextOrder);
		sectionOrderSaveCount += 1;
		sectionOrderSaveBusy = true;
		sectionOrderSaveError = "";
		const saveRequest = sectionOrderSaveQueue.then(() =>
			saveCloudMixSectionOrder(normalizedOrder),
		);
		sectionOrderSaveQueue = saveRequest.catch(() => false);
		void saveRequest
			.then((saved) => {
				sectionOrderSaveError = saved
					? ""
					: "We could not save your section order. Check your connection and try again.";
			})
			.catch(() => {
				sectionOrderSaveError =
					"We could not save your section order. Check your connection and try again.";
			})
			.finally(() => {
				sectionOrderSaveCount -= 1;
				sectionOrderSaveBusy = sectionOrderSaveCount > 0;
			});
		return saveRequest;
	};

	const finishReorganizing = async () => {
		const saved = await queueSectionOrderSave(sectionOrder);
		if (saved) closeMixOverlay();
	};

	const updateSectionDisclosureState = (
		sectionId: MixSectionId,
		open: boolean,
	) => {
		if (sectionDisclosureState[sectionId] === open) return;
		sectionDisclosureState = {
			...sectionDisclosureState,
			[sectionId]: open,
		};
		const nextState = { ...sectionDisclosureState };
		const saveRequest = sectionDisclosureSaveQueue.then(() =>
			saveCloudMixSectionDisclosureState(nextState),
		);
		sectionDisclosureSaveQueue = saveRequest.catch(() => false);
		void saveRequest
			.then((saved) => {
				sectionDisclosureSaveError = saved
					? ""
					: "Your section layout could not be saved. Your current Mix is still safe.";
			})
			.catch(() => {
				sectionDisclosureSaveError =
					"Your section layout could not be saved. Your current Mix is still safe.";
			});
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
	const nutrientAdjustmentSuggestions = $derived(
		getNutrientAdjustmentSuggestions({
			nutrients: selectedNutrients,
			selectedFoods,
			nutrientGoals,
			servingGrams,
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
		...getFoodPreferenceSmartWarnings(selectedFoods),
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
        const persistedMixState = writeStoredMixState(mixState);
        void saveCloudMixPreferences({ mixState: persistedMixState });
    };

    const loadCloudBackedMixPreferences = () => {
        const cloudPreferences = initialMixData?.preferences;
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

		sectionOrder = normalizeMixSectionOrder(cloudPreferences.sectionOrder);
		sectionDisclosureState = normalizeMixSectionDisclosureState(
			cloudPreferences.sectionDisclosureState,
		);

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
		closeMixOverlay();
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
        closeMixOverlay();
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
        closeMixOverlay();
    };

    const handleChange = (next: (string | number)[]) => {
        selected = next;
        markLoadedSavedDrinkDirty();
        saveMixState();
    };

	const handleAddNutrient = (nutrientId: string | number) => {
		const nutrient = nutrientCatalog.find((n) => n.id == nutrientId);
		if (!nutrient || selected.some((id) => id == nutrient.id)) return;
		if (!options.some((option) => option.id == nutrient.id)) {
			options = [...options, { id: nutrient.id, label: nutrient.label }];
		}
		selected = [...selected, nutrient.id];
		markLoadedSavedDrinkDirty();
		saveMixState();
	};

	const handleRemoveNutrient = (nutrientId: string | number) => {
		handleChange(selected.filter((id) => id != nutrientId));
	};

	const previewGoal = (id: string | number, value: string) => {
		nutrientGoals = {
			...nutrientGoals,
			[Number(id)]: Math.max(0, Number(value) || 0),
		};
		markLoadedSavedDrinkDirty();
		selectedGoalTemplateId = "";
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
		markLoadedSavedDrinkDirty();
		saveMixState();
	};

	const getServingConversionWarning = (food: FdcFood) => {
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

	const cancelMixScrollTrackingResume = () => {
		if (mixScrollResumeFrame !== null) cancelAnimationFrame(mixScrollResumeFrame);
		if (mixScrollSettleFrame !== null) cancelAnimationFrame(mixScrollSettleFrame);
		mixScrollResumeFrame = null;
		mixScrollSettleFrame = null;
	};

	const resumeMixScrollTrackingAfterLayoutSettles = (element: HTMLElement) => {
		cancelMixScrollTrackingResume();
		mixScrollResumeFrame = requestAnimationFrame(() => {
			mixScrollSettleFrame = requestAnimationFrame(() => {
				mixPageScrollDirectionTracker.resume(element.scrollTop);
				compactHeaderLayoutSettling = false;
				mixScrollResumeFrame = null;
				mixScrollSettleFrame = null;
			});
		});
	};

	const handleMixPageScroll = (event: Event) => {
		if (mixRouteState.overlay !== null) return;
		const element = event.currentTarget as HTMLElement;
		const direction = mixPageScrollDirectionTracker.update(element.scrollTop);
		if (direction === "down") {
			compactHeaderLayoutSettling = true;
			mixPageScrollDirectionTracker.pause(element.scrollTop);
			resumeMixScrollTrackingAfterLayoutSettles(element);
		}
		if (direction) compactTopHidden = direction === "down";
	};

    onMount(() => {
        const restoredSavedDrink = readLoadedSavedDrink();
        loadedSavedDrink = restoredSavedDrink;
        loadMixState();
        loadNutrientGoals();
		loadCloudBackedMixPreferences();
		mixStateReady = true;
		window.addEventListener(
            SMOOTHIE_LISTS_CHANGED_EVENT,
            loadIngredientLists,
        );
        return () => {
			window.removeEventListener(
                SMOOTHIE_LISTS_CHANGED_EVENT,
                loadIngredientLists,
            );
        };
    });

	$effect(() => {
		const element = mixScrollContainer;
		if (!element || typeof ResizeObserver === "undefined") return;

		const observer = new ResizeObserver(() => {
			if (compactHeaderLayoutSettling) {
				mixPageScrollDirectionTracker.pause(element.scrollTop);
				resumeMixScrollTrackingAfterLayoutSettles(element);
				return;
			}

			mixPageScrollDirectionTracker.rebase(element.scrollTop);
		});
		observer.observe(element);

		return () => {
			observer.disconnect();
			cancelMixScrollTrackingResume();
			compactHeaderLayoutSettling = false;
		};
	});

	$effect(() => {
		if (
			mixStateReady &&
			openWarningId !== null &&
			!smartWarnings.some((warning) => warning.id === openWarningId)
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
	<ViewTop compactHidden={compactTopHidden}>
		<MixHeader
			loadedName={loadedSavedDrink?.name}
			isDirty={loadedSavedDrink?.isDirty ?? selectedFoodIds.length > 0}
			canSave={canSaveCurrentMix}
			optionsOpen={optionsSheetOpen}
			onSave={() => {
				saveDialogError = "";
				navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.save });
			}}
			onOpenOptions={() => navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.options })}
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
		onResetGoals={() => navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.resetGoals })}
		onClearIngredients={() => navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.clearIngredients })}
		onResetAll={() => navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.resetAll })}
	/>

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
            closeMixOverlay();
        }}
	    >
	        <SaveGoalReview diffs={saveGoalDiffs} />
	    </TextInputDialog>

	<ViewBody>
		<div
			class="mix-page"
			bind:this={mixScrollContainer}
			onscroll={handleMixPageScroll}
		>

	{#if cloudLoadError}
		<StatusMessage tone="danger" title="Database lists unavailable">
			{cloudLoadError}
		</StatusMessage>
	{/if}
	{#if sectionDisclosureSaveError}
		<StatusMessage tone="warning" title="Section layout not saved">
			{sectionDisclosureSaveError}
		</StatusMessage>
	{/if}

	{#if reorganizeMode}
		<MixSectionOrganizer
			order={sectionOrder}
			busy={sectionOrderSaveBusy}
			error={sectionOrderSaveError}
			onOrderChange={(nextOrder) => {
				sectionOrder = normalizeMixSectionOrder(nextOrder);
			}}
			onOrderCommit={(nextOrder) => {
				void queueSectionOrderSave(nextOrder);
			}}
			onDone={() => {
				void finishReorganizing();
			}}
		/>
	{:else}
	<section class="mix-panel" aria-label="Mix builder">
		<div class="mix-builder">
			{#each sectionOrder as sectionId (sectionId)}
			{#if sectionId === "nutrient-shape"}
				<NutrientShapePanel
				points={selectedCount}
				values={chartValues}
				{goalValues}
				labels={nutrientLabels}
				valueLabels={nutrientValueLabels}
				{pointColors}
				fillColor={chartColors.fill}
				strokeColor={chartColors.stroke}
				diffs={saveGoalDiffs}
				open={sectionDisclosureState[sectionId]}
				onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
				/>

			{:else if sectionId === "goals"}
				<GoalTargets
                {selectedNutrients}
                {nutrientGoals}
                {selectedGoalTemplateId}
                onTemplateChange={updateGoalTemplateSelection}
				onApplyTemplate={applyGoalTemplate}
				onPreviewGoal={previewGoal}
				onUpdateGoal={updateGoal}
				onAddNutrient={handleAddNutrient}
				onRemoveNutrient={handleRemoveNutrient}
				getGoal={getDefaultNutrientGoal}
				getTotal={getNutrientTotal}
				open={sectionDisclosureState[sectionId]}
				onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
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
					open={sectionDisclosureState[sectionId]}
					onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
                />

			{:else if sectionId === "add-ingredients"}
				<IngredientChooser
					{fridgeItems}
					{shoppingItems}
					{selectedFoodIds}
					onToggleFood={toggleFood}
					filtersOpen={ingredientFiltersOpen}
					onOpenFilters={() =>
						navigateMixRoute({ overlay: MIX_ROUTE_OVERLAYS.ingredientFilters })}
					onCloseFilters={closeMixOverlay}
					open={sectionDisclosureState[sectionId]}
					onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
				/>

			{:else if sectionId === "warnings"}
				<SmartWarnings
				warnings={smartWarnings}
				{openWarningId}
				onOpenWarning={openWarningRoute}
				onCloseWarning={closeMixOverlay}
				open={sectionDisclosureState[sectionId]}
				onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
				/>
			{:else if sectionId === "suggested-adjustments"}
				<NutrientAdjustmentSuggestions
					suggestions={nutrientAdjustmentSuggestions}
					onApply={applySuggestedAdjustment}
					open={sectionDisclosureState[sectionId]}
					onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
				/>
			{:else if sectionId === "nutrient-contributions"}
				<IngredientContributionBreakdown
					breakdowns={contributionBreakdowns}
					open={sectionDisclosureState[sectionId]}
					onOpenChange={(open) => updateSectionDisclosureState(sectionId, open)}
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
