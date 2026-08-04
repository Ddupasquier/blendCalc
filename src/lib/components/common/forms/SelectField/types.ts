export type SelectFieldOption = {
	value: string;
	label: string;
	disabled?: boolean;
	hidden?: boolean;
};

export type SelectFieldProps = {
	id: string;
	name?: string;
	class?: string;
	label?: string;
	labelVisibility?: "visible" | "sr-only";
	ariaLabel?: string;
	ariaDescribedBy?: string;
	ariaInvalid?: boolean;
	value?: string;
	options: readonly SelectFieldOption[];
	helper?: string;
	required?: boolean;
	disabled?: boolean;
	layout?: "stacked" | "inline";
	size?: "default" | "compact" | "small";
	width?: "full" | "content";
	element?: HTMLSelectElement | null;
	onValueChange?: (value: string) => void;
};
