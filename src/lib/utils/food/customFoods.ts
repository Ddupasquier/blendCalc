import {
	DEFAULT_MILLILITERS_PER_VOLUME_MEASURE,
	type ServingMeasureUnit,
} from "../../../defaults/servingMeasureDefaults";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/foodRecords";
import {
	saveCloudCustomFood,
	writeCloudCustomFoods,
} from "$lib/utils/storage/supabaseData";
import { getScopedStorageKey } from "$lib/utils/storage/storageScope";
import { NUTRIENT_IDS, type FdcFood, type FdcNutrient } from "$lib/utils/food/types";
import { normalizeCustomFoodName } from "$lib/utils/food/customFoodNames";

export const CUSTOM_FOODS_STORAGE_KEY = "smoothie-custom-foods";
export const CUSTOM_FOODS_CHANGED_EVENT = "smoothie-custom-foods-changed";

export type CustomFoodNutritionInput = {
	calories: number;
	fat: number;
	carbs: number;
	fiber: number;
	sugar: number;
	protein: number;
};

export type CustomFoodInput = {
	name: string;
	brandOwner?: string;
	servingLabel?: string;
	servingWeightGrams: number;
	volumeQuantity?: number;
	volumeUnit?: ServingMeasureUnit;
	barcode?: string;
	barcodeSource?: FdcFood["barcodeSource"];
	nutrition: CustomFoodNutritionInput;
};

export type CustomFoodSaveResult =
	| "saved"
	| "duplicate-name"
	| "duplicate-barcode"
	| "error";

const CUSTOM_NUTRIENT_META = [
	{
		key: "calories",
		nutrientId: NUTRIENT_IDS.CALORIES,
		nutrientName: "Energy",
		nutrientNumber: "208",
		unitName: "KCAL",
	},
	{
		key: "fat",
		nutrientId: NUTRIENT_IDS.FAT,
		nutrientName: "Total Fat",
		nutrientNumber: "204",
		unitName: "G",
	},
	{
		key: "carbs",
		nutrientId: NUTRIENT_IDS.CARBS,
		nutrientName: "Total Carbohydrate",
		nutrientNumber: "205",
		unitName: "G",
	},
	{
		key: "fiber",
		nutrientId: NUTRIENT_IDS.FIBER,
		nutrientName: "Dietary Fiber",
		nutrientNumber: "291",
		unitName: "G",
	},
	{
		key: "sugar",
		nutrientId: NUTRIENT_IDS.SUGAR,
		nutrientName: "Total Sugars",
		nutrientNumber: "269",
		unitName: "G",
	},
	{
		key: "protein",
		nutrientId: NUTRIENT_IDS.PROTEIN,
		nutrientName: "Protein",
		nutrientNumber: "203",
		unitName: "G",
	},
] as const;

const dispatchCustomFoodsChanged = () => {
	window.dispatchEvent(new CustomEvent(CUSTOM_FOODS_CHANGED_EVENT));
};

const toSafeNumber = (value: number) => {
	return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const createCustomFoodId = () => {
	return -Math.floor(Date.now() * 1000 + Math.random() * 1000);
};

const getPer100GramValue = (valuePerServing: number, servingWeightGrams: number) => {
	return (toSafeNumber(valuePerServing) * 100) / servingWeightGrams;
};

const createNutrients = (
	nutrition: CustomFoodNutritionInput,
	servingWeightGrams: number,
): FdcNutrient[] => {
	return CUSTOM_NUTRIENT_META.map((meta) => ({
		nutrientId: meta.nutrientId,
		nutrientName: meta.nutrientName,
		nutrientNumber: meta.nutrientNumber,
		unitName: meta.unitName,
		value: getPer100GramValue(nutrition[meta.key], servingWeightGrams),
	}));
};

const getVolumeMilliliters = (
	quantity?: number,
	unit?: ServingMeasureUnit,
): number | null => {
	if (!quantity || !unit || !(unit in DEFAULT_MILLILITERS_PER_VOLUME_MEASURE)) {
		return null;
	}

	return (
		Math.max(0, quantity) *
		DEFAULT_MILLILITERS_PER_VOLUME_MEASURE[
			unit as keyof typeof DEFAULT_MILLILITERS_PER_VOLUME_MEASURE
		]
	);
};

export const createCustomFood = (input: CustomFoodInput): FdcFood => {
	const servingWeightGrams = Math.max(0.1, input.servingWeightGrams);
	const volumeMilliliters = getVolumeMilliliters(
		input.volumeQuantity,
		input.volumeUnit,
	);
	const density =
		volumeMilliliters && volumeMilliliters > 0
			? servingWeightGrams / volumeMilliliters
			: null;

	return {
		fdcId: createCustomFoodId(),
		description: input.name.trim(),
		brandOwner: input.brandOwner?.trim() || undefined,
		foodCategory: "Custom Ingredient",
		dataType: "Custom",
		servingSize: servingWeightGrams,
		servingSizeUnit: "g",
		customFood: true,
		barcode: input.barcode,
		barcodeSource: input.barcodeSource,
		customServingLabel: input.servingLabel?.trim() || undefined,
		customServingWeightGrams: servingWeightGrams,
		customDensityGramsPerMilliliter: density ?? undefined,
		customDensityLabel: density ? "custom serving" : undefined,
		customDensityVariancePercent: density ? 0 : undefined,
		customDensityConfidence: density ? "known" : undefined,
		foodNutrients: createNutrients(input.nutrition, servingWeightGrams),
	};
};

export const readCustomFoods = () => {
	try {
		const raw = localStorage.getItem(getScopedStorageKey(CUSTOM_FOODS_STORAGE_KEY));
		const foods = raw ? (JSON.parse(raw) as FdcFood[]) : [];
		return foods.map(compactFood);
	} catch {
		return [];
	}
};

export const cacheCustomFoodsLocally = (foods: FdcFood[]) => {
	try {
		localStorage.setItem(
			getScopedStorageKey(CUSTOM_FOODS_STORAGE_KEY),
			JSON.stringify(uniqueFoodsById(foods).map(compactFood)),
		);
	} catch {
		// ignore cache write failures; localStorage is only a fallback cache here
	}
};

export const writeCustomFoods = (foods: FdcFood[]) => {
	const compactFoods = uniqueFoodsById(foods).map(compactFood);

	localStorage.setItem(
		getScopedStorageKey(CUSTOM_FOODS_STORAGE_KEY),
		JSON.stringify(compactFoods),
	);
	void writeCloudCustomFoods(compactFoods);
	dispatchCustomFoodsChanged();
};

export const saveCustomFood = async (
	food: FdcFood,
): Promise<CustomFoodSaveResult> => {
	const foods = readCustomFoods();
	const normalizedName = normalizeCustomFoodName(food.description);
	if (
		foods.some(
			(item) => normalizeCustomFoodName(item.description) === normalizedName,
		)
	) {
		return "duplicate-name";
	}
	if (food.barcode && foods.some((item) => item.barcode === food.barcode)) {
		return "duplicate-barcode";
	}

	const foodRecord = compactFood(food);
	const cloudResult = await saveCloudCustomFood(foodRecord);
	if (cloudResult !== "saved") return cloudResult;

	const nextFoods = [
		foodRecord,
		...foods.filter((item) => item.fdcId !== food.fdcId),
	];
	localStorage.setItem(
		getScopedStorageKey(CUSTOM_FOODS_STORAGE_KEY),
		JSON.stringify(uniqueFoodsById(nextFoods).map(compactFood)),
	);
	dispatchCustomFoodsChanged();
	return "saved";
};

export const searchCustomFoods = (query: string) => {
	const terms = query
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
	if (terms.length === 0) return readCustomFoods();

	return readCustomFoods().filter((food) => {
		const text = [
			food.description,
			food.brandOwner,
			food.foodCategory,
			food.customServingLabel,
			food.barcode,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return terms.every((term) => text.includes(term));
	});
};
