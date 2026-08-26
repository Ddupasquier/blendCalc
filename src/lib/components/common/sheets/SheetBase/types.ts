import type { Snippet } from "svelte";
import type { DialogReturnFocusTarget } from "$lib/utils/accessibility/dialogFocus";

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
	returnFocusTarget?: DialogReturnFocusTarget;
	children: Snippet;
	onClose?: () => void;
};
