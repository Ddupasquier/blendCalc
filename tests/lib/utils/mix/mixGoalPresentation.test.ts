import { describe, expect, it } from "vitest";
import {
	formatMixGoalTarget,
	formatMixGoalValueComparison,
	getMixGoalStatusTone,
} from "$lib/utils/mix/formatting/mixGoalPresentation";

describe("Mix goal presentation", () => {
	it("uses the same units and trace policy for actual and target values", () => {
		const goal = {
			goalType: "minimum" as const,
			targetAmount: 25,
			upperAmount: null,
		};

		expect(formatMixGoalTarget(goal, "g")).toBe("≥25 g");
		expect(formatMixGoalValueComparison(0.0004, goal, "g")).toBe(
			"<0.001 g / ≥25 g",
		);
	});

	it("formats exact, maximum, and range targets without inventing units", () => {
		expect(
			formatMixGoalTarget(
				{ goalType: "exact", targetAmount: 350, upperAmount: null },
				"kcal",
			),
		).toBe("=350 kcal");
		expect(
			formatMixGoalTarget(
				{ goalType: "maximum", targetAmount: 15, upperAmount: null },
				"g",
			),
		).toBe("≤15 g");
		expect(
			formatMixGoalTarget(
				{ goalType: "range", targetAmount: 20, upperAmount: 30 },
				"g",
			),
		).toBe("20–30 g");
	});

	it("maps every evaluation status to one semantic tone", () => {
		expect(getMixGoalStatusTone("under")).toBe("warning");
		expect(getMixGoalStatusTone("met")).toBe("success");
		expect(getMixGoalStatusTone("over")).toBe("danger");
	});
});
