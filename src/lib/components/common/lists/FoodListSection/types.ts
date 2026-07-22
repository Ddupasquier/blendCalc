import type { Snippet } from "svelte";

export type FoodListSectionProps = {
	title: string;
	count: number;
	ariaLabel: string;
	hasItems: boolean;
	placeholder?: string;
	children?: Snippet;
};
