export type FoodPreferencePickerProps = {
	availableOptions: string[];
	disabled?: boolean;
	emptyLabel: string;
	filteredOptions: string[];
	helper: string;
	onAdd: (value: string) => void;
	onRemove: (value: string) => void;
	onSearchChange: (value: string) => void;
	onSelectChange: (value: string) => void;
	searchLabel: string;
	searchValue: string;
	selectedValues: string[];
	selectLabel: string;
	selectValue: string;
	title: string;
};
