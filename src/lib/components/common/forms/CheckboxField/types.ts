import type { Snippet } from "svelte";
import type { ChangeEventHandler } from "svelte/elements";

export type CheckboxFieldProps = {
	id?: string;
	name?: string;
	value?: string | number;
	checked?: boolean;
	required?: boolean;
	disabled?: boolean;
	onchange?: ChangeEventHandler<HTMLInputElement>;
	children: Snippet;
};
