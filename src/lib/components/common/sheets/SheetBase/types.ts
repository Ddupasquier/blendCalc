import type { Snippet } from "svelte";

export type SheetPlacement = "bottom" | "right";

export type SheetBaseProps = {
	id?: string;
	open?: boolean;
	placement: SheetPlacement;
	label?: string;
	labelledby?: string;
	modal?: boolean;
	backdrop?: boolean;
	closeOnBackdrop?: boolean;
	aboveNav?: boolean;
	fill?: boolean;
	comfortable?: boolean;
	className?: string;
	panelClass?: string;
	children: Snippet;
	onClose?: () => void;
};
