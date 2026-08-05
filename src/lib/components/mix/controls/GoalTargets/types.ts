import type { NutrientMeta } from "$lib/utils/mix/calculations";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type GoalTargetsProps = MixSectionDisclosureProps & {
	selectedNutrients: NutrientMeta[];
	nutrientGoals: Record<number, number>;
	selectedGoalTemplateId: string;
	onTemplateChange: (templateId: string) => void;
	onApplyTemplate: () => void;
	onPreviewGoal: (id: string | number, value: string) => void;
	onUpdateGoal: (id: string | number, value: string) => void;
	onAddNutrient: (id: string | number) => void;
	onRemoveNutrient: (id: string | number) => void;
	getGoal: (nutrient: NutrientMeta) => number;
	getTotal: (nutrientId: number) => number;
};
