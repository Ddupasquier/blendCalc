import type { FdcFood } from "$lib/utils/food/types";
import type {
	NutrientContributionBreakdown,
	NutrientFoodSuggestion,
	NutrientMeta,
	NutrientReductionSuggestion,
} from "$lib/utils/mix/calculations";
import type {
	NutrientChip,
	NutrientOption,
	SaveGoalDiff,
} from "$lib/utils/mix/ui/mixUi";
import type { SmartWarning } from "$lib/utils/mix/warnings/smartWarnings";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";

export type SaveGoalReviewProps = {
	diffs: SaveGoalDiff[];
};

export type NutrientSelectorProps = {
	options: NutrientOption[];
	selected: (string | number)[];
	selectedCount: number;
	onChange: (next: (string | number)[]) => void;
	onAddNutrient: (id: string | number) => void;
};

export type NutrientPickerProps = {
	excludedIds: (string | number)[];
	onSelect: (id: string | number) => void;
};

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

export type IngredientCardProps = {
	food: FdcFood;
	sourceLabel: string;
	quantity: number;
	unit: ServingMeasureUnit;
	gramsLabel: string;
	warning?: string | null;
	nutrientChips?: NutrientChip[];
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FdcFood,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};

export type SelectedIngredientsPanelProps = {
	selectedFoods: FdcFood[];
	fridgeItems: FdcFood[];
	selectedNutrients: NutrientMeta[];
	servingGrams: Record<number, number>;
	getServingQuantity: (food: FdcFood) => number;
	getServingUnit: (food: FdcFood) => ServingMeasureUnit;
	getServingConversion: (food: FdcFood) => ServingConversion;
	getServingConversionWarning: (food: FdcFood) => string | null | undefined;
	onRemove: (foodId: number) => void;
	onServingChange: (
		food: FdcFood,
		quantityValue: string,
		unit: ServingMeasureUnit,
	) => void;
};

export type IngredientChooserProps = {
	fridgeItems: FdcFood[];
	shoppingItems: FdcFood[];
	selectedFoodIds: number[];
	onToggleFood: (foodId: number) => void;
};

export type IngredientContributionBreakdownProps = {
	breakdowns?: NutrientContributionBreakdown[];
};

export type NutrientAdjustment =
	| { type: "add"; suggestion: NutrientFoodSuggestion }
	| { type: "reduce"; suggestion: NutrientReductionSuggestion };

export type NutrientAdjustmentSuggestionsProps = {
	foodSuggestions?: NutrientFoodSuggestion[];
	reductionSuggestions?: NutrientReductionSuggestion[];
	onAdd: (foodId: number, servingGrams: number) => void;
	onReduce: (foodId: number, nextServingGrams: number) => void;
	maxSuggestions?: number;
};

export type SmartWarningsProps = {
	warnings?: SmartWarning[];
};
