import type { FoodPreferenceOption } from "$lib/utils/profile/foodPreferenceOptions";

export type FoodPreferencePickerProps = {
	id: string;
	options: FoodPreferenceOption[];
	disabled?: boolean;
	emptyLabel: string;
	onAdd: (value: string) => void;
	onClear: () => void;
	onRemove: (value: string) => void;
	clearLabel: string;
	customEntryLabel: string;
	selectedValues: string[];
	title: string;
	labelledBy: string;
	unresolvedValues?: string[];
	referenceDataUnavailable?: boolean;
};
