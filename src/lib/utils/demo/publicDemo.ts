import { scalePer100gValue } from "$lib/utils/food/nutrients/nutritionDisplay";

export const DEMO_NUTRIENTS = [
	{ key: "energy", label: "Energy", unit: "kcal" },
	{ key: "protein", label: "Protein", unit: "g" },
	{ key: "carbohydrate", label: "Carbohydrate", unit: "g" },
	{ key: "fat", label: "Fat", unit: "g" },
	{ key: "fiber", label: "Fiber", unit: "g" },
] as const;

export type DemoNutrientKey = (typeof DEMO_NUTRIENTS)[number]["key"];
export type DemoNutrients = Record<DemoNutrientKey, number>;

// Deliberately illustrative examples, never catalog records or label evidence.
export const DEMO_FOODS = [
	{
		id: "oats",
		name: "Rolled oats",
		category: "Grains",
		description: "A sample pantry staple for the base of a breakfast bowl.",
		note: "Oats may contain gluten. Check the actual package.",
		defaultGrams: "100",
		nutrients: {
			energy: 380,
			protein: 13,
			carbohydrate: 68,
			fat: 7,
			fiber: 10,
		},
	},
	{
		id: "yogurt",
		name: "Plain yogurt",
		category: "Dairy",
		description: "A sample ingredient to compare with the oats and berries.",
		note: "Yogurt contains milk. These examples are not an allergen check.",
		defaultGrams: "150",
		nutrients: { energy: 60, protein: 10, carbohydrate: 4, fat: 0, fiber: 0 },
	},
	{
		id: "berries",
		name: "Berries",
		category: "Fruit",
		description: "A sample fruit portion to explore how amounts change a Mix.",
		note: "No recall lookup is performed in this demo.",
		defaultGrams: "75",
		nutrients: { energy: 50, protein: 1, carbohydrate: 12, fat: 0, fiber: 3 },
	},
] as const;

export type DemoFoodId = (typeof DEMO_FOODS)[number]["id"];
export type DemoAmounts = Record<DemoFoodId, string>;

export const createDemoAmounts = (): DemoAmounts =>
	Object.fromEntries(
		DEMO_FOODS.map((food) => [food.id, food.defaultGrams]),
	) as DemoAmounts;

export const parseDemoGrams = (value: string): number | null => {
	if (!/^\d{1,4}$/.test(value)) return null;
	const grams = Number(value);
	return grams <= 1000 ? grams : null;
};

export const calculateDemoMix = (amounts: DemoAmounts) => {
	const entries = DEMO_FOODS.map((food) => ({
		food,
		grams: parseDemoGrams(amounts[food.id]),
	}));
	if (entries.some((entry) => entry.grams === null)) return null;
	const nutrients: DemoNutrients = {
		energy: 0,
		protein: 0,
		carbohydrate: 0,
		fat: 0,
		fiber: 0,
	};
	let grams = 0;
	for (const entry of entries) {
		const amount = entry.grams!;
		grams += amount;
		if (amount === 0) continue;
		for (const nutrient of DEMO_NUTRIENTS) {
			nutrients[nutrient.key] += scalePer100gValue(
				entry.food.nutrients[nutrient.key],
				amount,
			)!;
		}
	}
	return { grams, nutrients };
};

export type LabelIngredient = {
	id: number;
	name: string;
	grams: string;
	labelGrams: string;
	nutrients: Record<DemoNutrientKey, string>;
};

export const MAX_LABEL_INGREDIENTS = 20;

export const createLabelIngredient = (id: number): LabelIngredient => ({
	id,
	name: "",
	grams: "",
	labelGrams: "",
	nutrients: { energy: "", protein: "", carbohydrate: "", fat: "", fiber: "" },
});

/** Plain decimal inputs only. A blank is unknown, never an inferred zero. */
export const parseLabelAmount = (value: string): number | null => {
	if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
	const amount = Number(value);
	return Number.isFinite(amount) && amount <= 100_000 ? amount : null;
};

export const calculateLabelRecipe = (
	ingredients: readonly LabelIngredient[],
	servings: string,
) => {
	const count = parseLabelAmount(servings);
	if (
		!count ||
		!Number.isInteger(count) ||
		count > 1000 ||
		!ingredients.length ||
		ingredients.length > MAX_LABEL_INGREDIENTS
	)
		return null;
	const totals: Record<DemoNutrientKey, number | null> = {
		energy: 0,
		protein: 0,
		carbohydrate: 0,
		fat: 0,
		fiber: 0,
	};
	let grams = 0;
	for (const ingredient of ingredients) {
		const amount = parseLabelAmount(ingredient.grams);
		if (amount === null) return null;
		// An explicitly omitted ingredient contributes nothing, even without a label.
		if (amount === 0) continue;
		const basis = parseLabelAmount(ingredient.labelGrams);
		if (!basis) return null;
		grams += amount;
		for (const { key } of DEMO_NUTRIENTS) {
			const raw = ingredient.nutrients[key];
			if (raw === "") {
				totals[key] = null;
				continue;
			}
			const value = parseLabelAmount(raw);
			if (value === null) return null;
			const contribution = (value * amount) / basis;
			if (!Number.isFinite(contribution)) return null;
			if (totals[key] !== null) totals[key] += contribution;
		}
	}
	const perServing = Object.fromEntries(
		DEMO_NUTRIENTS.map(({ key }) => [
			key,
			totals[key] === null ? null : totals[key] / count,
		]),
	) as typeof totals;
	return { grams, servings: count, totals, perServing };
};
