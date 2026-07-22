import type {
	ManualEntryNutrientDefinition,
	ManualEntryNutrientGroup,
} from "$lib/utils/food/nutrients/nutrientDefinitions";
import type { NutritionLabelOcrMapping } from "$lib/utils/food/ocr/nutritionLabelOcr";
import type {
	ManualEntryValidationItem,
	NutritionLabelOcrApplyPayload,
} from "../../formTypes";

export type NutrientStepProps = {
	groups: ManualEntryNutrientGroup[];
	loading: boolean;
	error: string;
	helper: string;
	validationItems?: ManualEntryValidationItem[];
	accordion?: boolean;
	defaultOpenFirst?: boolean;
	hideUnavailableStatus?: boolean;
	labelOcrMappings?: NutritionLabelOcrMapping[];
	labelOcrMappingError?: string;
	nutritionPhoto?: File | null;
	onNutritionPhotoChange?: (file: File | null) => void;
	onApplyNutritionLabelOcr?: (payload: NutritionLabelOcrApplyPayload) => void;
	getValue: (field: ManualEntryNutrientDefinition) => number | null;
	onValueChange: (
		field: ManualEntryNutrientDefinition,
		value: string,
	) => void;
	isRequired: (field: ManualEntryNutrientDefinition) => boolean;
	onBack: () => void;
	onNext: () => void;
};
