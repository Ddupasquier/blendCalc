import type { NutrientMeta } from "$lib/utils/mix/calculations";

export type GoalTargetsProps = {
	selectedNutrients: NutrientMeta[];
	nutrientGoals: Record<number, number>;
	selectedGoalTemplateId: string;
	onTemplateChange: (templateId: string) => void;
	onApplyTemplate: () => void;
	onUpdateGoal: (id: string | number, value: string) => void;
	getGoal: (nutrient: NutrientMeta) => number;
	getTotal: (nutrientId: number) => number;
};
