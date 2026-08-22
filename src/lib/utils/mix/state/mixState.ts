import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import {
	getDefaultMixFields,
	getMixRuntimeConfiguration,
	getNutrientCatalog,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodItem } from "$lib/utils/food/types";
import { getScopedStorageKey } from "$lib/utils/storage/client/storageScope";
import {
	canConvertServingUnit,
	convertServingAmount,
	convertServingToGrams,
	parseServingAmount,
} from "$lib/utils/serving/servingAmount";
import {
	getDefaultNutrientOptions,
	getDefaultServingAmount,
	mergeNutrientOptions,
	normalizeNutrientOptions,
	normalizeServingUnit,
	optionsFromSelectedNutrientIds,
	type NutrientOption,
	type LegacyPersistedMixState,
} from "$lib/utils/mix/ui/mixUi";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export const MIX_STATE_STORAGE_VERSION = 1;

export type MixStateSnapshot = {
	selected: (string | number)[];
	options: NutrientOption[];
	selectedFoodIds: number[];
	servingGrams: Record<number, number>;
	servingQuantities: Record<number, number>;
	servingUnits: Record<number, ServingMeasureUnit>;
};

export type PersistedMixState = MixStateSnapshot & {
	version: typeof MIX_STATE_STORAGE_VERSION;
};

export type ServingStateSnapshot = Pick<
	MixStateSnapshot,
	"servingGrams" | "servingQuantities" | "servingUnits"
>;

export const getDefaultMixState = (): MixStateSnapshot => ({
	selected: getDefaultMixFields().map((nutrient) => nutrient.id),
	options: getDefaultNutrientOptions(),
	selectedFoodIds: [],
	servingGrams: {},
	servingQuantities: {},
	servingUnits: {},
});

export const getEmptyServingState = (): ServingStateSnapshot => ({
	servingGrams: {},
	servingQuantities: {},
	servingUnits: {},
});

export const getServingQuantity = (
	food: FoodItem,
	servingQuantities: Record<number, number>,
) => {
  return (
    servingQuantities[food.fdcId] ??
    getMixRuntimeConfiguration().defaultServingGrams
  );
};

export const getServingUnit = (
	food: FoodItem,
	servingUnits: Record<number, ServingMeasureUnit>,
) => {
	return normalizeServingUnit(servingUnits[food.fdcId], food) ?? "g";
};

export const getServingConversion = (
	food: FoodItem,
	servingQuantities: Record<number, number>,
	servingUnits: Record<number, ServingMeasureUnit>,
) => {
	return convertServingAmount(
		getServingQuantity(food, servingQuantities),
		getServingUnit(food, servingUnits),
		food,
	);
};

export const readStoredMixState = (
	fallbackState: MixStateSnapshot,
	allIngredientItems: FoodItem[],
): MixStateSnapshot => {
	const defaultMixFields = getDefaultMixFields();
	const nutrientCatalog = getNutrientCatalog();
	const defaultServingGrams = getMixRuntimeConfiguration().defaultServingGrams;
	try {
		const rawState = localStorage.getItem(
			getScopedStorageKey(MIX_STORAGE_KEYS.mixState),
		);
		if (!rawState) return fallbackState;

		const persistedMixState = JSON.parse(rawState) as LegacyPersistedMixState;
		if (persistedMixState.version !== MIX_STATE_STORAGE_VERSION) {
			return fallbackState;
		}
		const normalizedSavedOptions = normalizeNutrientOptions(persistedMixState.options);
		const selected = Array.isArray(persistedMixState.selected)
			? persistedMixState.selected
			: fallbackState.selected;
		const options = mergeNutrientOptions(
			getDefaultNutrientOptions(),
			normalizedSavedOptions,
      optionsFromSelectedNutrientIds(selected, [
        defaultMixFields,
        nutrientCatalog,
      ]),
		);
		const selectedFoodIds = Array.isArray(persistedMixState.selectedFoodIds)
			? persistedMixState.selectedFoodIds.filter((id) => Number.isFinite(id))
			: [];
		const storedServingGrams = Object.fromEntries(
			Object.entries(persistedMixState.servingGrams ?? {})
				.map(([id, grams]) => [Number(id), Number(grams)])
        .filter(([id, grams]) => Number.isFinite(id) && Number.isFinite(grams)),
		);
		const servingQuantities = Object.fromEntries(
			selectedFoodIds.map((foodId) => {
				const parsedInput = persistedMixState.servingInputs?.[foodId]
					? parseServingAmount(persistedMixState.servingInputs[foodId])
					: null;
				const savedQuantity = Number(persistedMixState.servingQuantities?.[foodId]);
				return [
					foodId,
					Number.isFinite(savedQuantity)
						? savedQuantity
						: (parsedInput?.quantity ??
							storedServingGrams[foodId] ??
							defaultServingGrams),
				];
			}),
		);
		const servingUnits = Object.fromEntries(
			selectedFoodIds.map((foodId) => {
				const food = allIngredientItems.find((item) => item.fdcId === foodId);
				const parsedInput = persistedMixState.servingInputs?.[foodId]
					? parseServingAmount(persistedMixState.servingInputs[foodId])
					: null;
				const requestedUnit =
						normalizeServingUnit(
							persistedMixState.servingUnits?.[foodId],
							food,
						) ??
					parsedInput?.unit ??
					"g";
				return [
					foodId,
					canConvertServingUnit(requestedUnit, food) ? requestedUnit : "g",
				];
			}),
		);
		const servingGrams = Object.fromEntries(
			selectedFoodIds.map((foodId) => {
				const food = allIngredientItems.find((item) => item.fdcId === foodId);
				const quantity =
					servingQuantities[foodId] ??
					storedServingGrams[foodId] ??
					defaultServingGrams;
				const unit = servingUnits[foodId] ?? "g";
				return [
					foodId,
					convertServingToGrams(quantity, unit, food) ??
						storedServingGrams[foodId] ??
						defaultServingGrams,
				];
			}),
		);

		return {
			selected,
			options,
			selectedFoodIds,
			servingGrams,
			servingQuantities,
			servingUnits,
		};
	} catch {
		return getDefaultMixState();
	}
};

export const createPersistedMixState = (
	mixState: MixStateSnapshot,
): PersistedMixState => ({
	version: MIX_STATE_STORAGE_VERSION,
	...mixState,
});

export const writeStoredMixState = (mixState: MixStateSnapshot) => {
	const persistedState = createPersistedMixState(mixState);
	localStorage.setItem(
		getScopedStorageKey(MIX_STORAGE_KEYS.mixState),
		JSON.stringify(persistedState),
	);
	return persistedState;
};

export const writeStoredRawMixState = (mixState: Record<string, unknown>) => {
	const storageKey = getScopedStorageKey(MIX_STORAGE_KEYS.mixState);
	if (mixState.version !== MIX_STATE_STORAGE_VERSION) {
		localStorage.removeItem(storageKey);
		return;
	}
	localStorage.setItem(storageKey, JSON.stringify(mixState));
};

export const getMixStateSnapshot = ({
	selected,
	options,
	selectedFoodIds,
	servingGrams,
	servingQuantities,
	servingUnits,
}: MixStateSnapshot): MixStateSnapshot => ({
	selected,
	options,
	selectedFoodIds,
	servingGrams,
	servingQuantities,
	servingUnits,
});

export const getStateWithToggledFood = (
	state: MixStateSnapshot,
	foodId: number,
	allIngredientItems: FoodItem[],
): MixStateSnapshot => {
	if (state.selectedFoodIds.includes(foodId)) {
		return {
			...state,
			selectedFoodIds: state.selectedFoodIds.filter((id) => id !== foodId),
		};
	}

	const food = allIngredientItems.find((item) => item.fdcId === foodId);
	const defaultServing = getDefaultServingAmount(food);

	return {
		...state,
		selectedFoodIds: [...state.selectedFoodIds, foodId],
		servingGrams: {
			...state.servingGrams,
			[foodId]:
				state.servingGrams[foodId] ??
        convertServingToGrams(
          defaultServing.quantity,
          defaultServing.unit,
          food,
        ) ??
				getMixRuntimeConfiguration().defaultServingGrams,
		},
		servingQuantities: {
			...state.servingQuantities,
			[foodId]: state.servingQuantities[foodId] ?? defaultServing.quantity,
		},
		servingUnits: {
			...state.servingUnits,
			[foodId]: state.servingUnits[foodId] ?? defaultServing.unit,
		},
	};
};

export const getStateWithGramServing = (
	state: MixStateSnapshot,
	foodId: number,
	nextServingGrams: number,
	shouldSelect = false,
): MixStateSnapshot => ({
	...state,
	selectedFoodIds:
		shouldSelect && !state.selectedFoodIds.includes(foodId)
			? [...state.selectedFoodIds, foodId]
			: state.selectedFoodIds,
	servingGrams: {
		...state.servingGrams,
		[foodId]: nextServingGrams,
	},
	servingQuantities: {
		...state.servingQuantities,
		[foodId]: nextServingGrams,
	},
	servingUnits: {
		...state.servingUnits,
		[foodId]: "g",
	},
});

export const getStateWithServingAmount = (
	state: MixStateSnapshot,
	food: FoodItem,
	quantityValue: string,
	unit: ServingMeasureUnit,
): MixStateSnapshot => {
	const quantity = toFiniteNonnegativeNumber(quantityValue);
	if (quantity === null) return state;
	const grams = convertServingToGrams(quantity, unit, food);
	if (grams === null) return state;

	return {
		...state,
		servingQuantities: {
			...state.servingQuantities,
			[food.fdcId]: quantity,
		},
		servingUnits: {
			...state.servingUnits,
			[food.fdcId]: unit,
		},
		servingGrams: {
			...state.servingGrams,
			[food.fdcId]: grams,
		},
	};
};
