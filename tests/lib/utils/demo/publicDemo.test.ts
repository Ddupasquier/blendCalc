import { describe, expect, it } from "vitest";
import {
	calculateDemoMix,
	calculateLabelRecipe,
	createLabelIngredient,
	parseLabelAmount,
	createDemoAmounts,
	parseDemoGrams,
} from "$lib/utils/demo/publicDemo";

describe("temporary public demo amounts", () => {
	it("calculates the example using per-100g scaling", () => {
		const mix = calculateDemoMix(createDemoAmounts())!;
		expect(mix.grams).toBe(325);
		expect(mix.nutrients).toEqual({
			energy: 507.5,
			protein: 28.75,
			carbohydrate: 83,
			fat: 7,
			fiber: 12.25,
		});
	});
	it("scales a changed portion and excludes explicit zero portions", () => {
		const mix = calculateDemoMix({ oats: "50", yogurt: "0", berries: "0" })!;
		expect(mix.grams).toBe(50);
		expect(mix.nutrients.energy).toBe(190);
		expect(mix.nutrients.protein).toBe(6.5);
	});
	it("represents an empty Mix without invented nutrients", () => {
		expect(
			calculateDemoMix({ oats: "0", yogurt: "0", berries: "0" })?.nutrients
				.energy,
		).toBe(0);
	});
	it.each(["", "-1", "0.5", "1001", "10000", "Infinity", "1e2", "oops"])(
		"pauses totals for invalid input %s",
		(value) => {
			expect(parseDemoGrams(value)).toBeNull();
			expect(
				calculateDemoMix({ ...createDemoAmounts(), oats: value }),
			).toBeNull();
		},
	);
	it("accepts both boundaries and returns independent reset state", () => {
		expect(parseDemoGrams("0")).toBe(0);
		expect(parseDemoGrams("1000")).toBe(1000);
		const first = createDemoAmounts();
		first.oats = "1";
		expect(createDemoAmounts().oats).toBe("100");
	});
});

describe("private on-page label calculator", () => {
	const oats = () => ({
		...createLabelIngredient(1),
		name: "Oats",
		grams: "80",
		labelGrams: "40",
		nutrients: {
			energy: "150",
			protein: "5",
			carbohydrate: "27",
			fat: "3",
			fiber: "4",
		},
	});
	it("scales exact label servings, combines ingredients and divides portions", () => {
		const yogurt = {
			...createLabelIngredient(2),
			grams: "150",
			labelGrams: "150",
			nutrients: {
				energy: "90",
				protein: "15",
				carbohydrate: "6",
				fat: "0",
				fiber: "0",
			},
		};
		const result = calculateLabelRecipe([oats(), yogurt], "2")!;
		expect(result.grams).toBe(230);
		expect(result.totals.energy).toBe(390);
		expect(result.perServing.energy).toBe(195);
		expect(result.perServing.protein).toBe(12.5);
	});
	it("keeps missing nutrients incomplete without hiding known totals", () => {
		const food = oats();
		food.nutrients.fiber = "";
		const result = calculateLabelRecipe([food, oats()], "1")!;
		expect(result.totals.fiber).toBeNull();
		expect(result.perServing.fiber).toBeNull();
		expect(result.totals.energy).toBe(600);
	});
	it("excludes explicit zero quantities without needing a label", () => {
		const excluded = { ...createLabelIngredient(2), grams: "0" };
		expect(calculateLabelRecipe([oats(), excluded], "1")?.totals.energy).toBe(
			300,
		);
	});
	it("preserves fractional gram and nutrient precision before display", () => {
		const food = oats();
		food.grams = "10.5";
		food.labelGrams = "100";
		food.nutrients.fat = "2.5";
		expect(calculateLabelRecipe([food], "3")?.perServing.fat).toBeCloseTo(
			0.0875,
		);
	});
	it.each(["", "-1", "Infinity", "1e2", "100001", "oops"])(
		"rejects invalid quantities %s",
		(value) => {
			expect(parseLabelAmount(value)).toBeNull();
			expect(
				calculateLabelRecipe([{ ...oats(), grams: value }], "1"),
			).toBeNull();
		},
	);
	it.each(["0", "", "0.5", "1001", "-1"])(
		"rejects invalid portion counts %s",
		(count) => {
			expect(calculateLabelRecipe([oats()], count)).toBeNull();
		},
	);
	it("rejects zero bases, bad entered nutrients and unbounded ingredient lists", () => {
		expect(
			calculateLabelRecipe([{ ...oats(), labelGrams: "0" }], "1"),
		).toBeNull();
		const food = oats();
		food.nutrients.energy = "-2";
		expect(calculateLabelRecipe([food], "1")).toBeNull();
		expect(calculateLabelRecipe([], "1")).toBeNull();
		expect(
			calculateLabelRecipe(Array.from({ length: 21 }, oats), "1"),
		).toBeNull();
	});
	it("rejects arithmetic overflow from an unusably small label weight", () => {
		const food = oats();
		food.labelGrams = `0.${"0".repeat(322)}5`;
		expect(calculateLabelRecipe([food], "1")).toBeNull();
	});
	it("starts with blank fields and independent ingredient state", () => {
		const first = createLabelIngredient(1);
		first.nutrients.energy = "1";
		expect(createLabelIngredient(2).nutrients.energy).toBe("");
		expect(createLabelIngredient(2).grams).toBe("");
	});
});
