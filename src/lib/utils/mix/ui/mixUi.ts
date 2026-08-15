import {
	SERVING_MEASURE_ALIASES,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import {
	getDefaultMixFields,
	getMixRuntimeConfiguration,
} from "$lib/utils/food/reference/appReferenceCatalog";
import {
	getFoodNutrientAmount,
	type NutrientMeta,
} from "$lib/utils/mix/calculations";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import type { MixWarning } from "$lib/utils/mix/warnings/mixWarnings";
import type { FoodItem } from "$lib/utils/food/types";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";
import { formatMixGoalValueComparison } from "$lib/utils/mix/formatting/mixGoalPresentation";

export type NutrientOption = { id: string | number; label: string };

export type LegacyPersistedMixState = {
	version?: number;
	selected?: (string | number)[];
	options?: NutrientOption[];
	selectedFoodIds?: number[];
	servingGrams?: Record<string, number>;
	servingInputs?: Record<string, string>;
	servingQuantities?: Record<string, number>;
	servingUnits?: Record<string, ServingMeasureUnit>;
};

export type NutrientChip = {
	label: string;
	value: string;
};

export type NutrientOverageDetail = {
	nutrientId: number;
	label: string;
	unit: string;
	total: number;
	goal: number;
	overage: number;
	contributors: {
		label: string;
		amount: number;
		grams: number;
	}[];
};

export type SaveGoalDiff = {
	nutrientId: number;
	label: string;
	unit: string;
	total: number;
	goal: number;
	upperGoal: number | null;
	goalType: "exact" | "minimum" | "maximum" | "range";
	difference: number;
	percentOfGoal: number;
	status: "met" | "over" | "under";
};

export const getDefaultNutrientOptions = () => {
	return getDefaultMixFields().map((nutrient) => ({
		id: nutrient.id,
		label: nutrient.label,
	}));
};

export const getNutrientMeta = (
	id: string | number,
	nutrientLists: NutrientMeta[][],
) => {
	return nutrientLists.flat().find((nutrient) => nutrient.id == id);
};

export const mergeNutrientOptions = (...optionLists: NutrientOption[][]) => {
	const seen = new Set<string>();
	return optionLists.flat().filter((option) => {
		const key = String(option.id);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const normalizeNutrientOptions = (value: unknown): NutrientOption[] => {
	if (!Array.isArray(value)) return [];

	return value.flatMap((option) => {
		if (
			option &&
			typeof option === "object" &&
			"id" in option &&
			"label" in option &&
			(typeof option.id === "string" || typeof option.id === "number") &&
			typeof option.label === "string"
		) {
			return [{ id: option.id, label: option.label }];
		}

		return [];
	});
};

export const optionsFromSelectedNutrientIds = (
	selectedIds: (string | number)[],
	nutrientLists: NutrientMeta[][],
) => {
	return selectedIds.flatMap((id) => {
		const nutrient = getNutrientMeta(id, nutrientLists);
		return nutrient ? [{ id: nutrient.id, label: nutrient.label ?? "" }] : [];
	});
};

export const getFoodSourceLabel = (food: FoodItem, fridgeItems: FoodItem[]) => {
	return fridgeItems.some((item) => item.fdcId === food.fdcId)
		? "Fridge"
		: "Shopping";
};

export const getFoodNutrientChips = (
	food: FoodItem,
	selectedNutrients: NutrientMeta[],
	servingGrams: Record<number, number>,
): NutrientChip[] => {
	return selectedNutrients
		.map((nutrient) => ({
			label: (nutrient.label ?? "").replace("Total ", ""),
			amount: getFoodNutrientAmount(food, Number(nutrient.id), servingGrams),
			unit: nutrient.unit ?? "",
		}))
		.filter(
			(chip): chip is typeof chip & { amount: number } =>
				chip.amount !== null && chip.amount > 0,
		)
		.sort((a, b) => b.amount - a.amount)
		.slice(0, 3)
		.map((chip) => ({
			label: chip.label,
			value: formatMixQuantity(chip.amount, {
				unit: chip.unit,
				sign: "always",
			}),
		}));
};

export const normalizeServingUnit = (value: unknown) => {
	if (typeof value !== "string") return null;
	return (
		SERVING_MEASURE_ALIASES[value.trim().toLowerCase().replace(/\s+/g, "")] ??
		null
	);
};

export const getDefaultServingAmount = (food?: FoodItem) => {
	const servingUnit = normalizeServingUnit(food?.servingSizeUnit);
	if (food?.servingSize && servingUnit) {
		return {
			quantity: food.servingSize,
			unit: servingUnit,
		};
	}

	return {
		quantity: getMixRuntimeConfiguration().defaultServingGrams,
		unit: "g" as ServingMeasureUnit,
	};
};

export const getServingGramsLabel = (conversion: ServingConversion) => {
	return conversion.grams === null
		? "Gram conversion unavailable"
		: `${formatMixQuantity(conversion.grams, { unit: "g" })} equivalent`;
};

export const getServingConversionBasis = (conversion: ServingConversion) => {
	if (!conversion.available || !conversion.basis) return null;
	return conversion.method === "calculated-conversion"
		? `Calculated from ${conversion.basis}`
		: `Exact unit conversion: ${conversion.basis}`;
};

export const withOverageDetails = (
	warning: MixWarning,
	overages: NutrientOverageDetail[],
): MixWarning => {
	if (!warning.id.startsWith("over-")) return warning;

	const nutrientId = Number(warning.id.replace("over-", ""));
	const overage = overages.find((item) => item.nutrientId === nutrientId);
	if (!overage) return warning;

	return {
		...warning,
		detailSummary: `${formatMixGoalValueComparison(
			overage.total,
			{
				goalType: "maximum",
				targetAmount: overage.goal,
				upperAmount: null,
			},
			overage.unit,
		)} (${formatMixQuantity(overage.overage, {
			unit: overage.unit,
			sign: "always",
		})})`,
		details: overage.contributors.map((contributor) => ({
			label: contributor.label,
			value: `${formatMixQuantity(contributor.amount, {
				unit: overage.unit,
			})} from ${formatMixQuantity(contributor.grams, { unit: "g" })}`,
		})),
	};
};
