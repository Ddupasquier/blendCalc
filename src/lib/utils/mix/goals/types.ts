export const MIX_GOAL_TYPES = ["exact", "minimum", "maximum", "range"] as const;

export const MIX_GOAL_BASES = ["per_mix", "per_serving"] as const;

export type MixGoalType = (typeof MIX_GOAL_TYPES)[number];
export type MixGoalBasis = (typeof MIX_GOAL_BASES)[number];

export type MixNutrientGoal = {
  nutrientId: number;
  goalType: MixGoalType;
  targetAmount: number;
  upperAmount: number | null;
  toleranceRatio: number;
  importanceWeight: number;
  sortOrder: number;
  rationale?: string | null;
  sourceKey?: string | null;
  sourceReference?: string | null;
};

export type MixGoalMap = Record<number, MixNutrientGoal>;

export type MixGoalTemplateScope = "system" | "user";

export type MixGoalTemplate = {
  id: string;
  selectionId: string;
  scope: MixGoalTemplateScope;
  versionId: string | null;
  version: number | null;
  label: string;
  description: string;
  goalBasis: MixGoalBasis;
  goals: MixGoalMap;
  sourceKey: string | null;
  sourceReference: string | null;
  reviewedAt: string | null;
  isDefault: boolean;
};

export type MixGoalConfiguration = {
  goals: MixGoalMap;
  goalBasis: MixGoalBasis;
  sourceTemplateVersionId: string | null;
  sourceUserTemplateId: string | null;
  templateCustomized: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isMixGoalType = (value: unknown): value is MixGoalType =>
  typeof value === "string" && MIX_GOAL_TYPES.includes(value as MixGoalType);

export const isMixGoalBasis = (value: unknown): value is MixGoalBasis =>
  typeof value === "string" && MIX_GOAL_BASES.includes(value as MixGoalBasis);

const asFiniteNonnegative = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const normalizeMixGoal = (
  value: unknown,
  fallbackToleranceRatio: number,
  fallbackNutrientId?: number,
  fallbackSortOrder = 1,
): MixNutrientGoal | null => {
  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      fallbackNutrientId === undefined
    ) {
      return null;
    }
    return {
      nutrientId: fallbackNutrientId,
      goalType: "exact",
      targetAmount: value,
      upperAmount: null,
      toleranceRatio: fallbackToleranceRatio,
      importanceWeight: 1,
      sortOrder: fallbackSortOrder,
    };
  }

  if (!isRecord(value)) return null;
  const nutrientId = Number(value.nutrientId ?? fallbackNutrientId);
  const targetAmount = asFiniteNonnegative(value.targetAmount);
  const upperAmount =
    value.upperAmount === null || value.upperAmount === undefined
      ? null
      : asFiniteNonnegative(value.upperAmount);
  const toleranceRatio = asFiniteNonnegative(
    value.toleranceRatio ?? fallbackToleranceRatio,
  );
  const importanceWeight = asFiniteNonnegative(value.importanceWeight ?? 1);
  const sortOrder = Number(value.sortOrder ?? fallbackSortOrder);
  const goalType = value.goalType;

  if (
    !Number.isSafeInteger(nutrientId) ||
    nutrientId <= 0 ||
    !isMixGoalType(goalType) ||
    targetAmount === null ||
    toleranceRatio === null ||
    toleranceRatio > 1 ||
    importanceWeight === null ||
    importanceWeight <= 0 ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder <= 0 ||
    (goalType === "range" &&
      (upperAmount === null || upperAmount < targetAmount)) ||
    (goalType !== "range" && upperAmount !== null)
  ) {
    return null;
  }

  return {
    nutrientId,
    goalType,
    targetAmount,
    upperAmount,
    toleranceRatio,
    importanceWeight,
    sortOrder,
    rationale: typeof value.rationale === "string" ? value.rationale : null,
    sourceKey: typeof value.sourceKey === "string" ? value.sourceKey : null,
    sourceReference:
      typeof value.sourceReference === "string" ? value.sourceReference : null,
  };
};

export const normalizeMixGoalMap = (
  value: unknown,
  fallbackToleranceRatio: number,
): MixGoalMap => {
  const entries = Array.isArray(value)
    ? value.map((goal, index) => [String(index), goal] as const)
    : isRecord(value)
      ? Object.entries(value)
      : [];

  const goals = entries.flatMap(([key, rawGoal], index) => {
    const legacyNutrientId = Array.isArray(value) ? undefined : Number(key);
    const goal = normalizeMixGoal(
      rawGoal,
      fallbackToleranceRatio,
      Number.isSafeInteger(legacyNutrientId) ? legacyNutrientId : undefined,
      index + 1,
    );
    return goal ? [goal] : [];
  });

  return Object.fromEntries(
    goals
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((goal) => [goal.nutrientId, goal]),
  );
};

export const serializeMixGoals = (goals: MixGoalMap) =>
  Object.values(goals)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((goal) => ({
      nutrient_id: goal.nutrientId,
      goal_type: goal.goalType,
      target_amount: goal.targetAmount,
      upper_amount: goal.upperAmount,
      tolerance_ratio: goal.toleranceRatio,
      importance_weight: goal.importanceWeight,
      sort_order: goal.sortOrder,
    }));

export const getGoalTemplateSelectionId = (
  scope: MixGoalTemplateScope,
  id: string,
) => `${scope}:${id}`;

export const getMixGoalTargetAmount = (goal: MixNutrientGoal) =>
  goal.targetAmount;

export const withMixGoalTargetAmount = (
  goal: MixNutrientGoal,
  targetAmount: number,
): MixNutrientGoal => ({
  ...goal,
  targetAmount: Math.max(0, targetAmount),
  upperAmount:
    goal.goalType === "range"
      ? Math.max(goal.upperAmount ?? targetAmount, targetAmount)
      : null,
});

export const createExactMixGoal = ({
  nutrientId,
  targetAmount,
  toleranceRatio,
  sortOrder,
}: {
  nutrientId: number;
  targetAmount: number;
  toleranceRatio: number;
  sortOrder: number;
}): MixNutrientGoal => ({
  nutrientId,
  goalType: "exact",
  targetAmount: Math.max(0, targetAmount),
  upperAmount: null,
  toleranceRatio,
  importanceWeight: 1,
  sortOrder,
});

export const areMixGoalsEqual = (left: MixGoalMap, right: MixGoalMap) =>
  JSON.stringify(serializeMixGoals(left)) ===
  JSON.stringify(serializeMixGoals(right));
