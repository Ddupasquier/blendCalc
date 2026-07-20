export const DEFAULT_NUTRITION_VIEWING_GRAMS = 100;
export const MIN_NUTRITION_VIEWING_GRAMS = 1;
export const MAX_NUTRITION_VIEWING_GRAMS = 1000;
export const NUTRITION_VIEWING_GRAM_STEP = 1;

export const clampNutritionViewingGrams = (grams: number): number => {
	if (!Number.isFinite(grams)) return DEFAULT_NUTRITION_VIEWING_GRAMS;
	const steppedGrams = Math.round(grams);
	return Math.min(
		MAX_NUTRITION_VIEWING_GRAMS,
		Math.max(MIN_NUTRITION_VIEWING_GRAMS, steppedGrams),
	);
};

export const stepNutritionViewingGrams = (
	currentGrams: number,
	direction: "increase" | "decrease",
	step = NUTRITION_VIEWING_GRAM_STEP,
): number =>
	clampNutritionViewingGrams(
		currentGrams +
			(direction === "increase" ? Math.abs(step) : -Math.abs(step)),
	);

export const scalePer100gValue = (
	valuePer100g: number | null | undefined,
	viewingGrams: number,
): number | null => {
	if (!Number.isFinite(valuePer100g ?? NaN)) return null;
	return (Number(valuePer100g) * clampNutritionViewingGrams(viewingGrams)) / 100;
};

export const formatNutritionAmount = (
	value: number | null | undefined,
): string => {
	if (!Number.isFinite(value ?? NaN)) return "—";
	const numericValue = Number(value);
	if (Math.abs(numericValue) < 0.005) return "0";
	if (Math.abs(numericValue) >= 100) return Math.round(numericValue).toString();
	const decimals = Math.abs(numericValue) < 1 ? 2 : 1;
	return Number(numericValue.toFixed(decimals)).toString();
};

export const formatViewingGrams = (grams: number): string =>
	`${clampNutritionViewingGrams(grams)}g`;

export const getNutritionBasisLabel = (
	grams: number,
	servingLabel?: string,
): string => {
	const cleanServingLabel = servingLabel?.trim();
	if (cleanServingLabel) {
		return `Per ${cleanServingLabel} · ${formatViewingGrams(grams)}`;
	}
	return clampNutritionViewingGrams(grams) === DEFAULT_NUTRITION_VIEWING_GRAMS
		? "Per 100g food data"
		: `Per ${formatViewingGrams(grams)} viewing amount`;
};
