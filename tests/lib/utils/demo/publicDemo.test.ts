import { describe, expect, it } from "vitest";
import {
	calculateDemoMix,
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
