import type { MixNutrientGoal } from "./types";

export type MixGoalEvaluationStatus = "met" | "under" | "over";
export type MixGoalEvaluationTone = "success" | "warning" | "danger";

export type MixGoalEvaluation = {
  status: MixGoalEvaluationStatus;
  tone: MixGoalEvaluationTone;
  score: number;
  percent: number;
  difference: number;
  lowerBoundary: number;
  upperBoundary: number | null;
};

const clampScore = (value: number) => Math.max(0, Math.min(1, value));

const getRelativeScore = (actual: number, target: number) => {
  if (target <= 0) return actual <= 0 ? 1 : 0;
  return clampScore(actual / target);
};

const getOverageScore = (actual: number, target: number) => {
  if (target <= 0) return actual <= 0 ? 1 : 0;
  return clampScore(1 - (actual - target) / target);
};

export const evaluateMixGoal = (
  goal: MixNutrientGoal,
  actualAmount: number,
): MixGoalEvaluation => {
  const actual = Math.max(0, Number.isFinite(actualAmount) ? actualAmount : 0);
  const toleranceAmount = goal.targetAmount * goal.toleranceRatio;
  const lowerBoundary = Math.max(0, goal.targetAmount - toleranceAmount);
  const upperTarget = goal.upperAmount ?? goal.targetAmount;
  const upperBoundary = upperTarget + upperTarget * goal.toleranceRatio;

  if (goal.goalType === "minimum") {
    const met = actual >= lowerBoundary;
    return {
      status: met ? "met" : "under",
      tone: met ? "success" : "warning",
      score: met ? 1 : getRelativeScore(actual, goal.targetAmount),
      percent: getRelativeScore(actual, goal.targetAmount) * 100,
      difference: actual - goal.targetAmount,
      lowerBoundary,
      upperBoundary: null,
    };
  }

  if (goal.goalType === "maximum") {
    const met = actual <= upperBoundary;
    return {
      status: met ? "met" : "over",
      tone: met ? "success" : "danger",
      score: met ? 1 : getOverageScore(actual, goal.targetAmount),
      percent: (met ? 1 : getOverageScore(actual, goal.targetAmount)) * 100,
      difference: actual - goal.targetAmount,
      lowerBoundary: 0,
      upperBoundary,
    };
  }

  if (goal.goalType === "range") {
    if (actual < lowerBoundary) {
      return {
        status: "under",
        tone: "warning",
        score: getRelativeScore(actual, goal.targetAmount),
        percent: getRelativeScore(actual, goal.targetAmount) * 100,
        difference: actual - goal.targetAmount,
        lowerBoundary,
        upperBoundary,
      };
    }
    if (actual > upperBoundary) {
      const score = getOverageScore(actual, upperTarget);
      return {
        status: "over",
        tone: "danger",
        score,
        percent: score * 100,
        difference: actual - upperTarget,
        lowerBoundary,
        upperBoundary,
      };
    }
    return {
      status: "met",
      tone: "success",
      score: 1,
      percent: 100,
      difference: 0,
      lowerBoundary,
      upperBoundary,
    };
  }

  if (actual < lowerBoundary) {
    const score = getRelativeScore(actual, goal.targetAmount);
    return {
      status: "under",
      tone: "warning",
      score,
      percent: score * 100,
      difference: actual - goal.targetAmount,
      lowerBoundary,
      upperBoundary,
    };
  }
  if (actual > upperBoundary) {
    const score = getOverageScore(actual, goal.targetAmount);
    return {
      status: "over",
      tone: "danger",
      score,
      percent: score * 100,
      difference: actual - goal.targetAmount,
      lowerBoundary,
      upperBoundary,
    };
  }
  return {
    status: "met",
    tone: "success",
    score: 1,
    percent: 100,
    difference: actual - goal.targetAmount,
    lowerBoundary,
    upperBoundary,
  };
};

export const getWeightedMixGoalScore = (
  goals: Array<{ goal: MixNutrientGoal; actualAmount: number }>,
) => {
  const evaluated = goals.map(({ goal, actualAmount }) => ({
    goal,
    evaluation: evaluateMixGoal(goal, actualAmount),
  }));
  const totalWeight = evaluated.reduce(
    (total, item) => total + item.goal.importanceWeight,
    0,
  );
  if (totalWeight <= 0) return null;

  return Math.round(
    (evaluated.reduce(
      (total, item) =>
        total + item.evaluation.score * item.goal.importanceWeight,
      0,
    ) /
      totalWeight) *
      100,
  );
};

export const getMixGoalOperator = (
  goal: Pick<MixNutrientGoal, "goalType">,
) => {
  if (goal.goalType === "minimum") return "≥";
  if (goal.goalType === "maximum") return "≤";
  if (goal.goalType === "range") return "–";
  return "=";
};
