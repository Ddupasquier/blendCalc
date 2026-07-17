import type { Snippet } from "svelte";

export type SheetPlacement = "bottom" | "right";

export type SheetBaseProps = {
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

export type BottomSheetProps = {
	open: boolean;
	title?: string;
	titleId?: string;
	label?: string;
	backLabel?: string;
	showBack?: boolean;
	aboveNav?: boolean;
	fill?: boolean;
	comfortable?: boolean;
	children: Snippet;
	onClose: () => void;
};

export type RightSheetProps = {
	open?: boolean;
	labelledby: string;
	onClose?: () => void;
	children: Snippet;
};
