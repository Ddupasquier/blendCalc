import {
	SERVING_MEASURE_ALIASES,
	type ServingMeasureUnit,
} from "$lib/utils/serving/servingMeasureCatalog";
import {
	getDefaultMixFields,
	getMixRuntimeConfiguration,
} from "$lib/utils/food/reference/appReferenceCatalog";
import { getFoodNutrientAmount, type NutrientMeta } from "$lib/utils/mix/calculations";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import type { SmartWarning } from "$lib/utils/mix/warnings/smartWarnings";
import type { FdcFood } from "$lib/utils/food/types";

export type NutrientOption = { id: string | number; label: string };

export type SavedMixState = {
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
	label: string;
	unit: string;
	total: number;
	goal: number;
	difference: number;
	percentOfGoal: number;
	status: "near" | "over" | "under";
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

export const formatChartNumber = (value: number) => {
	const absoluteValue = Math.abs(value);
	if (absoluteValue >= 10000) return `${Math.round(value / 1000)}k`;
	if (absoluteValue >= 1000) return `${(value / 1000).toFixed(1)}k`;
	if (absoluteValue >= 10) return String(Math.round(value));
	return value.toFixed(1).replace(/\.0$/, "");
};

export const formatSignedChartNumber = (value: number) => {
	if (Math.abs(value) < 0.05) return "0";
	const sign = value > 0 ? "+" : "-";
	return `${sign}${formatChartNumber(Math.abs(value))}`;
};

export const getFoodSourceLabel = (food: FdcFood, fridgeItems: FdcFood[]) => {
	return fridgeItems.some((item) => item.fdcId === food.fdcId)
		? "Fridge"
		: "Shopping";
};

export const getFoodNutrientChips = (
	food: FdcFood,
	selectedNutrients: NutrientMeta[],
	servingGrams: Record<number, number>,
): NutrientChip[] => {
	return selectedNutrients
		.map((nutrient) => ({
			label: (nutrient.label ?? "").replace("Total ", ""),
			amount: getFoodNutrientAmount(food, Number(nutrient.id), servingGrams),
			unit: nutrient.unit ?? "",
		}))
		.filter((chip): chip is typeof chip & { amount: number } => chip.amount !== null && chip.amount > 0)
		.sort((a, b) => b.amount - a.amount)
		.slice(0, 3)
		.map((chip) => ({
			label: chip.label,
			value: `+${formatChartNumber(chip.amount)}${chip.unit}`,
		}));
};

export const normalizeServingUnit = (value: unknown) => {
	if (typeof value !== "string") return null;
	return (
		SERVING_MEASURE_ALIASES[value.trim().toLowerCase().replace(/\s+/g, "")] ??
		null
	);
};

export const getDefaultServingAmount = (food?: FdcFood) => {
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
	return conversion.grams === null ? "Unavailable" : `${conversion.grams.toFixed(1)}g`;
};

export const withOverageDetails = (
	warning: SmartWarning,
	overages: NutrientOverageDetail[],
): SmartWarning => {
	if (!warning.id.startsWith("over-")) return warning;

	const nutrientId = Number(warning.id.replace("over-", ""));
	const overage = overages.find((item) => item.nutrientId === nutrientId);
	if (!overage) return warning;

	return {
		...warning,
		detailSummary: `${formatChartNumber(overage.total)} / ${formatChartNumber(
			overage.goal,
		)}${overage.unit} (${formatSignedChartNumber(overage.overage)}${overage.unit})`,
		details: overage.contributors.map((contributor) => ({
			label: contributor.label,
			value: `${formatChartNumber(contributor.amount)}${overage.unit} from ${formatChartNumber(contributor.grams)}g`,
		})),
	};
};
