import type { Snippet } from "svelte";

export type CheckboxFieldProps = {
	id?: string;
	name?: string;
	value?: string | number;
	checked?: boolean;
	required?: boolean;
	disabled?: boolean;
	children: Snippet;
};
