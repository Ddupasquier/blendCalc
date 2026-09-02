import { describe, expect, it } from "vitest";
import {
	FRIDGE_DIAGNOSTIC_BUDGETS_MS,
	FRIDGE_FIELD_P75_BUDGETS_MS,
} from "$lib/config/performanceBudgets";

describe("Fridge performance budgets", () => {
	it("keeps p75 field targets within good Core Web Vitals thresholds", () => {
		expect(FRIDGE_FIELD_P75_BUDGETS_MS).toEqual({
			firstContentfulPaint: 2_500,
			largestContentfulPaint: 2_500,
			interactionToNextPaint: 200,
			timeToFirstByte: 800,
		});
	});

	it("sets diagnostic budgets for each instrumented route phase", () => {
		expect(FRIDGE_DIAGNOSTIC_BUDGETS_MS).toEqual({
			auth: 800,
			rootProfile: 1_000,
			rootReference: 1_000,
			ingredients: 1_500,
			totalServer: 3_000,
			hydration: 3_500,
			loadMore: 200,
		});
	});
});
