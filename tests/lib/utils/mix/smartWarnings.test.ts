import { describe, expect, it } from "vitest";
import { getNutrientGoalWarnings } from "$lib/utils/mix/warnings/smartWarnings";
import type { MixGoalType, MixNutrientGoal } from "$lib/utils/mix/goals/types";

const goal = (
  nutrientId: number,
  goalType: MixGoalType,
  targetAmount: number,
): MixNutrientGoal => ({
  nutrientId,
  goalType,
  targetAmount,
  upperAmount: null,
  toleranceRatio: 0,
  importanceWeight: 1,
  sortOrder: 1,
});

describe("smart warnings", () => {
	it("reports nutrients over goal", () => {
		const warnings = getNutrientGoalWarnings([
			{
				id: 2000,
				label: "Sugar",
				unit: "g",
				total: 33,
        goal: goal(2000, "maximum", 25),
			},
		]);

		expect(warnings).toEqual([
			expect.objectContaining({
				id: "over-2000",
				tone: "danger",
				message: "Sugar exceeds goal by 8g.",
			}),
		]);
	});

	it("reports nutrients under target", () => {
		const warnings = getNutrientGoalWarnings([
			{
				id: 1003,
				label: "Protein",
				unit: "g",
				total: 13,
        goal: goal(1003, "minimum", 25),
			},
		]);

		expect(warnings).toEqual([
			expect.objectContaining({
				id: "under-1003",
				tone: "warning",
				message: "Protein is under target by 12g.",
			}),
		]);
	});

	it("suppresses under-target warnings before ingredients are selected", () => {
		const warnings = getNutrientGoalWarnings(
			[
				{
					id: 1003,
					label: "Protein",
					unit: "g",
					total: 0,
          goal: goal(1003, "minimum", 25),
				},
			],
			{ includeUnderTargets: false },
		);

		expect(warnings).toEqual([]);
	});
});
