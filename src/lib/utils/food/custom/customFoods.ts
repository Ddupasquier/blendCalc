import {
	DEFAULT_MILLILITERS_PER_VOLUME_MEASURE,
	SERVING_MEASURE_OPTIONS,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/records/foodRecords";
import {
	saveCloudCustomFood,
	writeCloudCustomFoods,
} from "$lib/utils/storage/supabase";
import { cleanBarcode, normalizeBarcode } from "$lib/utils/barcode/barcode";
import { getScopedStorageKey } from "$lib/utils/storage/client/storageScope";
import type {
	FdcFood,
	FdcNutrient,
	FoodFieldProvenance,
	FoodFieldSource,
	FoodImageAsset,
	FoodBarcodeProvenance,
} from "$lib/utils/food/types";
import { normalizeCustomFoodName } from "$lib/utils/food/custom/customFoodNames";
import { formatSourceProductName } from "$lib/utils/products/productNameFormatting.js";

export const CUSTOM_FOODS_STORAGE_KEY = "smoothie-custom-foods";
export const CUSTOM_FOODS_CHANGED_EVENT = "smoothie-custom-foods-changed";

export type CustomFoodInput = {
	name: string;
	nameProvenance?: NonNullable<FdcFood["nameProvenance"]>;
	brandOwner?: string;
	servingLabel?: string;
	servingWeightGrams: number;
	volumeQuantity?: number;
	volumeUnit?: ServingMeasureUnit;
	barcode?: string;
	barcodeSource?: FdcFood["barcodeSource"];
	barcodeProvenance?: FoodBarcodeProvenance;
	sourceKey?: string;
	sourceLabel?: string;
	sourceDataType?: string;
	sourcePublishedDate?: string;
	sourceModifiedDate?: string;
	ingredients?: string;
	ingredientList?: string[];
	allergens?: string[];
	traces?: string[];
	dietaryTags?: string[];
	labels?: string[];
	categories?: string[];
	categoryOptionId?: string;
	image?: FoodImageAsset;
	fieldProvenance?: FoodFieldProvenance;
	nutrients: FdcNutrient[];
	reportedNutrientIds?: number[];
	hasSourceServing?: boolean;
};

export type CustomFoodSaveResult =
	| "saved"
	| "duplicate-name"
	| "duplicate-barcode"
	| "error";

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
	nutrients: FdcNutrient[],
	servingWeightGrams: number,
): FdcNutrient[] => {
	const seenIds = new Set<number>();
	return nutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.nutrientId);
		if (
			!Number.isFinite(nutrientId) ||
			seenIds.has(nutrientId)
		) {
			return [];
		}
		seenIds.add(nutrientId);
		return [{
			nutrientId,
			nutrientName: nutrient.nutrientName,
			nutrientNumber: String(nutrient.nutrientNumber ?? ""),
			unitName: nutrient.unitName,
			value: getPer100GramValue(nutrient.value, servingWeightGrams),
			valueOrigin: nutrient.valueOrigin,
			source: nutrient.source,
			sourceReference: nutrient.sourceReference,
			confidence: nutrient.confidence,
		}];
	});
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
		(DEFAULT_MILLILITERS_PER_VOLUME_MEASURE[unit] ?? 0)
	);
};

const formatServingNumber = (value: number) => {
	if (!Number.isFinite(value)) return "0";
	return String(Number(value.toFixed(2)));
};

const getServingUnitDisplay = (unit: ServingMeasureUnit) => {
	const option = SERVING_MEASURE_OPTIONS.find((item) => item.value === unit);
	const abbreviatedLabel = option?.label.match(/\(([^)]+)\)/)?.[1];
	return abbreviatedLabel ?? option?.value ?? unit;
};

export const buildCustomServingLabel = ({
	servingLabel,
	servingWeightGrams,
	volumeQuantity,
	volumeUnit,
}: {
	servingLabel?: string;
	servingWeightGrams: number;
	volumeQuantity?: number;
	volumeUnit?: ServingMeasureUnit;
}) => {
	const trimmedLabel = servingLabel?.trim();
	if (trimmedLabel) return trimmedLabel;
	if (volumeQuantity && volumeQuantity > 0 && volumeUnit) {
		return `${formatServingNumber(volumeQuantity)} ${getServingUnitDisplay(volumeUnit)}`;
	}
	return `${formatServingNumber(servingWeightGrams)}g serving`;
};

const normalizeServingSource = (
	source: FoodFieldSource["source"] | undefined,
): FdcNutrient["source"] => {
	if (source === "shared-catalog") return "community-reviewed";
	if (source === "wikimedia-commons") return "unknown";
	return source;
};

export const createCustomFood = (input: CustomFoodInput): FdcFood => {
	const servingWeightGrams = Math.max(0.1, input.servingWeightGrams);
	const nameProvenance = input.nameProvenance ??
		(normalizeBarcode(input.barcode ?? "") ? "barcode" : "user");
	const description = nameProvenance === "user"
		? input.name.trim().replace(/\s+/g, " ")
		: formatSourceProductName(input.name);
	const volumeMilliliters = getVolumeMilliliters(
		input.volumeQuantity,
		input.volumeUnit,
	);
	const density =
		volumeMilliliters && volumeMilliliters > 0
			? servingWeightGrams / volumeMilliliters
			: null;

	const foodNutrients = createNutrients(input.nutrients, servingWeightGrams);
	const servingLabel = buildCustomServingLabel({
		servingLabel: input.servingLabel,
		servingWeightGrams,
		volumeQuantity: input.volumeQuantity,
		volumeUnit: input.volumeUnit,
	});
	const hasSourceServing = input.hasSourceServing ?? true;
	const defaultServingSource = input.barcodeSource === "usda"
		? "usda"
		: input.barcodeSource === "open-food-facts"
			? "open-food-facts"
			: input.barcodeSource === "community"
				? "community-reviewed"
				: "user-label";
	const servingSource = normalizeServingSource(
		input.fieldProvenance?.serving?.source,
	) ?? defaultServingSource;
	const servingConfidence = input.fieldProvenance?.serving?.confidence ??
		(servingSource === "usda"
			? "source-verified"
			: servingSource === "open-food-facts"
				? "imported"
				: servingSource === "community-reviewed"
					? "moderator-reviewed"
					: "user-reported");

	return {
		fdcId: createCustomFoodId(),
		description,
		nameProvenance,
		brandOwner: input.brandOwner?.trim() || undefined,
		foodCategory: "Custom Ingredient",
		dataType: "Custom",
		servingSize: servingWeightGrams,
		servingSizeUnit: "g",
		hasSourceServing,
		foodServings: hasSourceServing
			? [{
				label: servingLabel,
				gramWeight: servingWeightGrams,
				amount: input.volumeQuantity,
				unitKey: input.volumeUnit,
				isPrimary: true,
				source: servingSource,
					sourceReference:
						input.fieldProvenance?.serving?.sourceReference ?? input.barcode,
				confidence: servingConfidence,
			}]
			: [],
		ingredients: input.ingredients?.trim() || undefined,
		ingredientList: input.ingredientList,
		allergens: input.allergens,
		traces: input.traces,
		dietaryTags: input.dietaryTags,
		labels: input.labels,
		categories: input.categories,
		categoryOptionId: input.categoryOptionId,
		image: input.image,
		fieldProvenance: input.fieldProvenance,
		customFood: true,
		barcode: input.barcode,
		barcodeSource: input.barcodeSource,
		barcodeProvenance: input.barcodeProvenance,
		sourceKey: input.sourceKey,
		sourceLabel: input.sourceLabel,
		sourceDataType: input.sourceDataType,
		sourcePublishedDate: input.sourcePublishedDate,
		sourceModifiedDate: input.sourceModifiedDate,
		customServingLabel: servingLabel,
		customServingWeightGrams: servingWeightGrams,
		customDensityGramsPerMilliliter: density ?? undefined,
		customDensityLabel: density ? "custom serving" : undefined,
		customDensityVariancePercent: density ? 0 : undefined,
		customDensityConfidence: density ? "known" : undefined,
		foodNutrients,
		reportedNutrientIds: input.reportedNutrientIds
			? [...new Set(input.reportedNutrientIds)]
			: foodNutrients.map((nutrient) => nutrient.nutrientId),
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

const getBarcodeComparisonKey = (barcode: string) => {
	const digits = cleanBarcode(barcode);
	if (!digits) return null;
	return normalizeBarcode(digits) ?? digits.padStart(14, "0");
};

export const findCustomFoodByBarcode = (barcode: string) => {
	const normalizedBarcode = getBarcodeComparisonKey(barcode);
	if (!normalizedBarcode) return null;
	return (
		readCustomFoods().find(
			(food) => getBarcodeComparisonKey(food.barcode ?? food.gtinUpc ?? "") === normalizedBarcode,
		) ?? null
	);
};

export const findCustomFoodByName = (name: string) => {
	const normalizedName = normalizeCustomFoodName(name);
	if (!normalizedName) return null;
	return (
		readCustomFoods().find(
			(food) => normalizeCustomFoodName(food.description) === normalizedName,
		) ?? null
	);
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
	if (food.barcode && findCustomFoodByBarcode(food.barcode)) {
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
			food.ingredients,
			...(food.ingredientList ?? []),
			...(food.allergens ?? []),
			...(food.traces ?? []),
			...(food.dietaryTags ?? []),
			...(food.labels ?? []),
			...(food.categories ?? []),
			food.barcode,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return terms.every((term) => text.includes(term));
	});
};
