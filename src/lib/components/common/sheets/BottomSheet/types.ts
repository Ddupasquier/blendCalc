import type { Snippet } from "svelte";
import type { DialogReturnFocusTarget } from "$lib/utils/accessibility/dialogFocus";

export type BottomSheetProps = {
	id?: string;
	open: boolean;
	title?: string;
	titleId?: string;
	label?: string;
	aboveNav?: boolean;
	fill?: boolean;
	comfortable?: boolean;
	returnFocusTarget?: DialogReturnFocusTarget;
	titleAccessory?: Snippet;
	children: Snippet;
	onClose: () => void;
};
