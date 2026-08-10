export type CheckboxGroupOption = {
	id: string | number;
	label: string;
};

export type CheckboxGroupProps = {
	id?: string;
	name?: string;
	options?: CheckboxGroupOption[];
	selected?: (string | number)[];
	disabled?: boolean;
	onChange?: (selected: (string | number)[]) => void;
};
