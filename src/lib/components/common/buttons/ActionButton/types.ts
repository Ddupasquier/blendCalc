import type { Snippet } from "svelte";
import type {
	ButtonClickHandler,
	ButtonType,
} from "$lib/components/common/buttons/types";

export type ActionButtonVariant =
	| "primary"
	| "secondary"
	| "highlight"
	| "success"
	| "danger"
	| "ghost";

export type ActionButtonSize = "small" | "medium" | "large";

export type ActionButtonProps = {
	type?: ButtonType;
	variant?: ActionButtonVariant;
	size?: ActionButtonSize;
	fullWidth?: boolean;
	busy?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
	onclick?: ButtonClickHandler;
	children?: Snippet;
	leading?: Snippet;
	trailing?: Snippet;
};
