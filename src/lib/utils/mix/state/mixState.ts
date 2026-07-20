import {
	MIX_STORAGE_KEYS,
} from "../../../../defaults/mixDefaults";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import {
	getDefaultMixFields,
	getDefaultMixGoals,
	getMixRuntimeConfiguration,
	getNutrientCatalog,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { FdcFood } from "$lib/utils/food/types";
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
	type SavedMixState,
} from "$lib/utils/mix/ui/mixUi";
import {
	hasLegacySodiumOption,
	migrateLegacyNutrientGoals,
	migrateLegacyNutrientIds,
	migrateLegacyNutrientOptions,
} from "$lib/utils/mix/nutrients/nutrientMappings";
import { toFiniteNonnegativeNumber } from "$lib/utils/numbers/finiteNumbers";

export type MixStateSnapshot = {
	selected: (string | number)[];
	options: NutrientOption[];
	selectedFoodIds: number[];
	servingGrams: Record<number, number>;
	servingQuantities: Record<number, number>;
	servingUnits: Record<number, ServingMeasureUnit>;
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
	food: FdcFood,
	servingQuantities: Record<number, number>,
) => {
	return servingQuantities[food.fdcId] ?? getMixRuntimeConfiguration().defaultServingGrams;
};

export const getServingUnit = (
	food: FdcFood,
	servingUnits: Record<number, ServingMeasureUnit>,
) => {
	return normalizeServingUnit(servingUnits[food.fdcId]) ?? "g";
};

export const getServingConversion = (
	food: FdcFood,
	servingQuantities: Record<number, number>,
	servingUnits: Record<number, ServingMeasureUnit>,
) => {
	return convertServingAmount(
		getServingQuantity(food, servingQuantities),
		getServingUnit(food, servingUnits),
		food,
	);
};

export const readStoredNutrientGoals = () => {
	const defaultGoals = getDefaultMixGoals();
	try {
		const rawGoals = localStorage.getItem(
			getScopedStorageKey(MIX_STORAGE_KEYS.nutrientGoals),
		);
		const rawMixState = localStorage.getItem(
			getScopedStorageKey(MIX_STORAGE_KEYS.mixState),
		);
		const storedOptions = rawMixState
			? normalizeNutrientOptions(
					(JSON.parse(rawMixState) as SavedMixState).options,
				)
			: [];
		const shouldMigrateLegacySodium = hasLegacySodiumOption(storedOptions);

		return rawGoals
			? {
					...defaultGoals,
					...migrateLegacyNutrientGoals(
						JSON.parse(rawGoals) as Record<number, number>,
						shouldMigrateLegacySodium,
					),
				}
			: { ...defaultGoals };
	} catch {
		return { ...defaultGoals };
	}
};

export const writeStoredNutrientGoals = (
	nextGoals: Record<number, number>,
) => {
	localStorage.setItem(
		getScopedStorageKey(MIX_STORAGE_KEYS.nutrientGoals),
		JSON.stringify(nextGoals),
	);
};

export const readStoredMixState = (
	fallbackState: MixStateSnapshot,
	allIngredientItems: FdcFood[],
): MixStateSnapshot => {
	const defaultMixFields = getDefaultMixFields();
	const nutrientCatalog = getNutrientCatalog();
	const defaultServingGrams = getMixRuntimeConfiguration().defaultServingGrams;
	try {
		const rawState = localStorage.getItem(
			getScopedStorageKey(MIX_STORAGE_KEYS.mixState),
		);
		if (!rawState) return fallbackState;

		const savedState = JSON.parse(rawState) as SavedMixState;
		const normalizedSavedOptions = normalizeNutrientOptions(savedState.options);
		const shouldMigrateLegacySodium = hasLegacySodiumOption(
			normalizedSavedOptions,
		);
		const selected = Array.isArray(savedState.selected)
			? migrateLegacyNutrientIds(
					savedState.selected,
					shouldMigrateLegacySodium,
				)
			: fallbackState.selected;
		const savedOptions = migrateLegacyNutrientOptions(normalizedSavedOptions);
		const options = mergeNutrientOptions(
			getDefaultNutrientOptions(),
			savedOptions,
			optionsFromSelectedNutrientIds(selected, [defaultMixFields, nutrientCatalog]),
		);
		const selectedFoodIds = Array.isArray(savedState.selectedFoodIds)
			? savedState.selectedFoodIds.filter((id) => Number.isFinite(id))
			: [];
		const storedServingGrams = Object.fromEntries(
			Object.entries(savedState.servingGrams ?? {})
				.map(([id, grams]) => [Number(id), Number(grams)])
				.filter(
					([id, grams]) => Number.isFinite(id) && Number.isFinite(grams),
				),
		);
		const servingQuantities = Object.fromEntries(
			selectedFoodIds.map((foodId) => {
				const parsedInput = savedState.servingInputs?.[foodId]
					? parseServingAmount(savedState.servingInputs[foodId])
					: null;
				const savedQuantity = Number(savedState.servingQuantities?.[foodId]);
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
				const parsedInput = savedState.servingInputs?.[foodId]
					? parseServingAmount(savedState.servingInputs[foodId])
					: null;
				const requestedUnit =
					normalizeServingUnit(savedState.servingUnits?.[foodId]) ??
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

export const writeStoredMixState = (mixState: MixStateSnapshot) => {
	localStorage.setItem(
		getScopedStorageKey(MIX_STORAGE_KEYS.mixState),
		JSON.stringify(mixState),
	);
};

export const writeStoredRawMixState = (mixState: Record<string, unknown>) => {
	localStorage.setItem(
		getScopedStorageKey(MIX_STORAGE_KEYS.mixState),
		JSON.stringify(mixState),
	);
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
	allIngredientItems: FdcFood[],
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
				convertServingToGrams(defaultServing.quantity, defaultServing.unit, food) ??
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
	food: FdcFood,
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
