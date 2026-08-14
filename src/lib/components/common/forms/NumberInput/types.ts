import type {
	FormEventHandler,
	FocusEventHandler,
	HTMLInputAttributes,
} from "svelte/elements";

export type NumberInputProps = {
	id?: string;
	name?: string;
	class?: string;
	value?: number | string | null;
	min?: number | string;
	max?: number | string;
	step?: number | string;
	placeholder: string;
	required?: boolean;
	disabled?: boolean;
	readonly?: boolean;
	autocomplete?: HTMLInputAttributes["autocomplete"];
	ariaLabel?: string;
	ariaRequired?: boolean;
	ariaDescribedBy?: string;
	selectOnFocus?: boolean;
	onValueChange?: (
		value: string,
		valueAsNumber: number | null,
		event: Event & { currentTarget: HTMLInputElement },
	) => void;
	onValueCommit?: (
		value: string,
		valueAsNumber: number | null,
		event: Event & { currentTarget: HTMLInputElement },
	) => void;
	onfocus?: FocusEventHandler<HTMLInputElement>;
	oninput?: FormEventHandler<HTMLInputElement>;
};
