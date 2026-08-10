import type {
	FormEventHandler,
	KeyboardEventHandler,
	HTMLInputAttributes,
} from "svelte/elements";

export type TextFieldProps = {
	id: string;
	name?: string;
	label: string;
	value?: string | null;
	type?: "text" | "search";
	placeholder?: string;
	helper?: string;
	required?: boolean;
	disabled?: boolean;
	maxlength?: number;
	autocomplete?: HTMLInputAttributes["autocomplete"];
	multiline?: boolean;
	rows?: number;
	labelVisibility?: "visible" | "sr-only";
	oninput?: FormEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onkeydown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};
