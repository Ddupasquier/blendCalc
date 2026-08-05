import type { ChangeEventHandler, FormEventHandler } from "svelte/elements";

export type RangeInputTone = "neutral" | "primary" | "success" | "warning" | "danger";

export type RangeInputProps = {
	id: string;
	name?: string;
	class?: string;
	value: number;
	min?: number;
	max: number;
	step?: number;
	fillValue?: number;
	tone?: RangeInputTone;
	disabled?: boolean;
	ariaLabel: string;
	ariaValueText?: string;
	onValueChange?: (
		value: number,
		event: Event & { currentTarget: HTMLInputElement },
	) => void;
	onValueCommit?: (
		value: number,
		event: Event & { currentTarget: HTMLInputElement },
	) => void;
	oninput?: FormEventHandler<HTMLInputElement>;
	onchange?: ChangeEventHandler<HTMLInputElement>;
};
