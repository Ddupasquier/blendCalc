import type {
	ManualEntryNutrientDefinition,
	ManualEntryNutrientGroup,
} from "$lib/utils/food/nutrients/nutrientDefinitions";

export type ManualEntryNutrientFieldsProps = {
	groups: ManualEntryNutrientGroup[];
	loading?: boolean;
	error?: string;
	accordion?: boolean;
	defaultOpenFirst?: boolean;
	getValue: (field: ManualEntryNutrientDefinition) => number | null;
	onValueChange: (field: ManualEntryNutrientDefinition, value: string) => void;
	isRequired?: (field: ManualEntryNutrientDefinition) => boolean;
	getGroupBadge?: (group: ManualEntryNutrientGroup) => string | undefined;
};
