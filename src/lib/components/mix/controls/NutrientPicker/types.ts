export type NutrientPickerProps = {
	excludedIds: (string | number)[];
	onSelect: (id: string | number) => void;
};
