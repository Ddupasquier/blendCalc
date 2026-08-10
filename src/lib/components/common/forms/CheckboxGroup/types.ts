export type CheckboxGroupOption = {
	id: string | number;
	label: string;
};

export type CheckboxGroupProps = {
	options?: CheckboxGroupOption[];
	selected?: (string | number)[];
	onChange?: (selected: (string | number)[]) => void;
};
