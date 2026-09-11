import type { CompatibleNutrientMappingCandidate } from "$lib/utils/moderation/nutrientMappingReview";

export type CompatibleNutrientPickerProps = {
	nutrients: readonly CompatibleNutrientMappingCandidate[];
	selectedNutrientId: string;
	disabled?: boolean;
	onValueChange: (nutrientId: string) => void;
};
