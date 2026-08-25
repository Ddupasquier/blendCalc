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
	type?: "text" | "search" | "email" | "password";
	placeholder?: string;
	helper?: string;
	required?: boolean;
	disabled?: boolean;
	minlength?: number;
	maxlength?: number;
	showCharacterCount?: boolean;
	autocomplete?: HTMLInputAttributes["autocomplete"];
	multiline?: boolean;
	rows?: number;
	labelVisibility?: "visible" | "sr-only";
	"aria-describedby"?: string;
	"aria-invalid"?: HTMLInputAttributes["aria-invalid"];
	oninput?: FormEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onkeydown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
};
