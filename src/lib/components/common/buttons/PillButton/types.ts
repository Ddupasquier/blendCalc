import type { Snippet } from "svelte";
import type {
	ButtonClickHandler,
	ButtonType,
} from "$lib/components/common/buttons/types";

export type PillButtonVariant = "neutral" | "primary" | "danger";

export type PillButtonProps = {
	type?: ButtonType;
	variant?: PillButtonVariant;
	pressed?: boolean;
	busy?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
	ariaLabel?: string;
	onclick?: ButtonClickHandler;
	children?: Snippet;
};
