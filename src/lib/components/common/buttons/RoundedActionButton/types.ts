import type { Snippet } from "svelte";
import type {
	ButtonClickHandler,
	ButtonType,
} from "$lib/components/common/buttons/types";

export type RoundedActionButtonVariant =
	| "primary"
	| "outline"
	| "quiet"
	| "soft"
	| "neutral"
	| "dashed";

export type RoundedActionButtonContentAlign = "center" | "start" | "space-between";

export type RoundedActionButtonProps = {
	id?: string;
	type?: ButtonType;
	variant?: RoundedActionButtonVariant;
	contentAlign?: RoundedActionButtonContentAlign;
	fullWidth?: boolean;
	busy?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
	"aria-controls"?: string;
	"aria-describedby"?: string;
	"aria-expanded"?: boolean | "true" | "false";
	"aria-pressed"?: boolean | "true" | "false";
	onclick?: ButtonClickHandler;
	children?: Snippet;
};
