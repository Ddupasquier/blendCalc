import {
	getFoodNutrientAmountForServingConversion,
	getFoodNutrientMeasurementBasis,
} from "$lib/utils/food/nutrients/foodNutrients";
import { formatNutritionAmount } from "$lib/utils/food/nutrients/nutritionDisplay";
import { formatNutrientUnitNameForDisplay } from "$lib/utils/food/nutrients/nutrientUnitNames";
import { getFoodServings } from "$lib/utils/food/servings/foodServings";
import type { FoodItem, FoodNutrient } from "$lib/utils/food/types";
import { DEFAULT_NUTRITION_VIEWING_CONVERSION } from "$lib/utils/food/nutrients/nutritionViewingAmount";

export type PrivilegedProductLookupScope = "stored" | "live";

export type PrivilegedProductLookupResult = {
	id: string;
	scope: PrivilegedProductLookupScope;
	providerKey: string;
	providerLabel: string;
	food: FoodItem;
};

export type PrivilegedProductLookupResponse = {
	query: string;
	scope: PrivilegedProductLookupScope;
	results: PrivilegedProductLookupResult[];
	note?: string;
};

export type ProductComparisonStatus =
	"match" | "different" | "missing" | "not-comparable";

export type ProductComparisonRow = {
	key: string;
	label: string;
	leftValue: string;
	rightValue: string;
	status: ProductComparisonStatus;
	detail?: string;
};

const normalizeText = (value: string | undefined) =>
	(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

const displayText = (value: string | undefined) =>
	value?.trim() || "Not stored";

const getBarcode = (food: FoodItem) => food.barcode ?? food.gtinUpc;

const getServingLabel = (food: FoodItem) => {
	const serving = getFoodServings(food)[0];
	if (!serving) return "No exact serving stored";
	const weight =
		typeof serving.gramWeight === "number" ? ` · ${serving.gramWeight} g` : "";
	return `${serving.label}${weight}`;
};

const compareText = (
	key: string,
	label: string,
	leftValue: string | undefined,
	rightValue: string | undefined,
): ProductComparisonRow => {
	const left = normalizeText(leftValue);
	const right = normalizeText(rightValue);
	return {
		key,
		label,
		leftValue: displayText(leftValue),
		rightValue: displayText(rightValue),
		status:
			!left || !right ? "missing" : left === right ? "match" : "different",
	};
};

const formatBasis = (nutrient: FoodNutrient) => {
	const basis = getFoodNutrientMeasurementBasis(nutrient);
	if (basis.kind === "serving") return `per ${basis.servingLabel}`;
	return `per ${basis.quantity} ${basis.unitKey}`;
};

const getNutrientDisplay = (
	food: FoodItem,
	nutrient: FoodNutrient | undefined,
) => {
	if (!nutrient) return null;
	const normalizedAmount = getFoodNutrientAmountForServingConversion(
		food,
		nutrient.nutrientId,
		DEFAULT_NUTRITION_VIEWING_CONVERSION,
	);
	const unit = formatNutrientUnitNameForDisplay(nutrient.unitName);
	return normalizedAmount === null
		? {
				value: nutrient.value,
				display: `${formatNutritionAmount(nutrient.value)} ${unit} (${formatBasis(nutrient)})`,
				comparable: false,
				unit,
			}
		: {
				value: normalizedAmount,
				display: `${formatNutritionAmount(normalizedAmount)} ${unit}`,
				comparable: true,
				unit,
			};
};

const amountsMatch = (left: number, right: number) => {
	const scale = Math.max(Math.abs(left), Math.abs(right), 1);
	return Math.abs(left - right) <= scale * 1e-9;
};

const compareNutrient = (
	nutrientId: number,
	leftFood: FoodItem,
	rightFood: FoodItem,
): ProductComparisonRow => {
	const leftNutrient = leftFood.foodNutrients.find(
		(nutrient) => nutrient.nutrientId === nutrientId,
	);
	const rightNutrient = rightFood.foodNutrients.find(
		(nutrient) => nutrient.nutrientId === nutrientId,
	);
	const left = getNutrientDisplay(leftFood, leftNutrient);
	const right = getNutrientDisplay(rightFood, rightNutrient);
	const label =
		leftNutrient?.nutrientName ??
		rightNutrient?.nutrientName ??
		`Nutrient ${nutrientId}`;

	if (!left || !right) {
		return {
			key: `nutrient:${nutrientId}`,
			label,
			leftValue: left?.display ?? "Not reported",
			rightValue: right?.display ?? "Not reported",
			status: "missing",
			detail: "One source does not report this nutrient.",
		};
	}
	if (!left.comparable || !right.comparable || left.unit !== right.unit) {
		return {
			key: `nutrient:${nutrientId}`,
			label,
			leftValue: left.display,
			rightValue: right.display,
			status: "not-comparable",
			detail:
				"The stored serving evidence cannot safely normalize both values to 100 g.",
		};
	}
	return {
		key: `nutrient:${nutrientId}`,
		label,
		leftValue: left.display,
		rightValue: right.display,
		status: amountsMatch(left.value, right.value) ? "match" : "different",
		detail: "Compared on the same 100 g basis.",
	};
};

const importantNutrientOrder = new Map(
	[1008, 1003, 1005, 1004, 1079, 2000, 1093].map((id, index) => [id, index]),
);

export const comparePrivilegedLookupProducts = (
	left: PrivilegedProductLookupResult,
	right: PrivilegedProductLookupResult,
) => {
	const identityRows = [
		compareText(
			"name",
			"Product name",
			left.food.description,
			right.food.description,
		),
		compareText("brand", "Brand", left.food.brandOwner, right.food.brandOwner),
		compareText(
			"barcode",
			"UPC / GTIN",
			getBarcode(left.food),
			getBarcode(right.food),
		),
		compareText(
			"serving",
			"Primary serving",
			getServingLabel(left.food),
			getServingLabel(right.food),
		),
	];
	const nutrientIds = [
		...new Set([
			...left.food.foodNutrients.map((nutrient) => nutrient.nutrientId),
			...right.food.foodNutrients.map((nutrient) => nutrient.nutrientId),
		]),
	].sort((leftId, rightId) => {
		const leftPriority = importantNutrientOrder.get(leftId);
		const rightPriority = importantNutrientOrder.get(rightId);
		if (leftPriority !== undefined || rightPriority !== undefined) {
			return (
				(leftPriority ?? Number.MAX_SAFE_INTEGER) -
				(rightPriority ?? Number.MAX_SAFE_INTEGER)
			);
		}
		const leftName = left.food.foodNutrients.find(
			(nutrient) => nutrient.nutrientId === leftId,
		)?.nutrientName;
		const rightName = right.food.foodNutrients.find(
			(nutrient) => nutrient.nutrientId === rightId,
		)?.nutrientName;
		return (leftName ?? "").localeCompare(rightName ?? "");
	});
	const nutrientRows = nutrientIds.map((nutrientId) =>
		compareNutrient(nutrientId, left.food, right.food),
	);
	const rows = [...identityRows, ...nutrientRows];
	return {
		rows,
		differenceCount: rows.filter((row) => row.status !== "match").length,
	};
};
