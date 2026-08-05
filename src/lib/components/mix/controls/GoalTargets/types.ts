import type { NutrientMeta } from "$lib/utils/mix/calculations";
import type {
  MixGoalMap,
  MixGoalTemplate,
  MixGoalType,
  MixNutrientGoal,
} from "$lib/utils/mix/goals/types";
import type { MixSectionDisclosureProps } from "$lib/utils/mix/ui/mixSectionOrder";

export type GoalTargetsProps = MixSectionDisclosureProps & {
	selectedNutrients: NutrientMeta[];
  nutrientGoals: MixGoalMap;
  goalTemplates: MixGoalTemplate[];
	selectedGoalTemplateId: string;
  templateCustomized: boolean;
  keepExtraGoals: boolean;
  busy?: boolean;
  error?: string;
	onTemplateChange: (templateId: string) => void;
  onKeepExtraGoalsChange: (keepExtraGoals: boolean) => void;
	onApplyTemplate: () => void;
  onSaveCurrentTemplate: () => void;
  onDeleteTemplate: (templateId: string) => void;
	onPreviewGoal: (id: string | number, value: string) => void;
	onUpdateGoal: (id: string | number, value: string) => void;
  onUpdateUpperGoal: (id: string | number, value: string) => void;
  onUpdateGoalType: (id: string | number, goalType: MixGoalType) => void;
	onAddNutrient: (id: string | number) => void;
	onRemoveNutrient: (id: string | number) => void;
  getGoal: (nutrient: NutrientMeta) => MixNutrientGoal;
	getTotal: (nutrientId: number) => number;
};
