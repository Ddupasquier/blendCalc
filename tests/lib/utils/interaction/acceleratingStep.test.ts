import { describe, expect, it } from "vitest";
import { getAcceleratingStep } from "$lib/utils/interaction/acceleratingStep";

describe("accelerating step thresholds", () => {
	it("increases the step after each full second of a hold", () => {
		expect(getAcceleratingStep(0)).toBe(1);
		expect(getAcceleratingStep(999)).toBe(1);
		expect(getAcceleratingStep(1000)).toBe(2);
		expect(getAcceleratingStep(1999)).toBe(2);
		expect(getAcceleratingStep(2000)).toBe(5);
		expect(getAcceleratingStep(3000)).toBe(10);
		expect(getAcceleratingStep(4000)).toBe(50);
		expect(getAcceleratingStep(10000)).toBe(50);
	});
});
