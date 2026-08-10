import { describe, expect, it } from "vitest";
import {
  evaluateMixGoal,
  getWeightedMixGoalScore,
} from "$lib/utils/mix/goals/goalEvaluation";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";

const goal = (
  goalType: MixNutrientGoal["goalType"],
  targetAmount: number,
  upperAmount: number | null = null,
  importanceWeight = 1,
): MixNutrientGoal => ({
  nutrientId: 1008,
  goalType,
  targetAmount,
  upperAmount,
  toleranceRatio: 0.05,
  importanceWeight,
  sortOrder: 1,
});

describe("Mix goal evaluation", () => {
  it("evaluates point targets on both sides of their tolerance", () => {
    expect(evaluateMixGoal(goal("exact", 100), 96).status).toBe("met");
    expect(evaluateMixGoal(goal("exact", 100), 80).status).toBe("under");
    expect(evaluateMixGoal(goal("exact", 100), 120).status).toBe("over");
  });

  it("does not penalize minimum goals for exceeding their target", () => {
    expect(evaluateMixGoal(goal("minimum", 25), 24).status).toBe("met");
    expect(evaluateMixGoal(goal("minimum", 25), 50)).toMatchObject({
      status: "met",
      score: 1,
    });
    expect(evaluateMixGoal(goal("minimum", 25), 10).status).toBe("under");
  });

  it("does not penalize maximum goals below their target", () => {
    expect(evaluateMixGoal(goal("maximum", 15), 0)).toMatchObject({
      status: "met",
      score: 1,
    });
    expect(evaluateMixGoal(goal("maximum", 15), 20).status).toBe("over");
  });

  it("evaluates bounded ranges against both limits", () => {
    const rangeGoal = goal("range", 20, 30);
    expect(evaluateMixGoal(rangeGoal, 18).status).toBe("under");
    expect(evaluateMixGoal(rangeGoal, 25).status).toBe("met");
    expect(evaluateMixGoal(rangeGoal, 35).status).toBe("over");
  });

  it("weights important goals when calculating the overall score", () => {
    expect(
      getWeightedMixGoalScore([
        { goal: goal("minimum", 100, null, 3), actualAmount: 50 },
        { goal: { ...goal("maximum", 10), nutrientId: 1004 }, actualAmount: 5 },
      ]),
    ).toBe(63);
  });
});
