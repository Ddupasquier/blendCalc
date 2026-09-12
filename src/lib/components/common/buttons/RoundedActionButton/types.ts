import type { Snippet } from "svelte";
import type {
	ButtonClickHandler,
	ButtonKeyboardHandler,
	ButtonPointerHandler,
	ButtonType,
} from "$lib/components/common/buttons/types";

export type RoundedActionButtonVariant =
	"primary" | "outline" | "quiet" | "soft" | "neutral" | "dashed" | "link";

export type RoundedActionButtonContentAlign =
	"center" | "start" | "space-between";

export type RoundedActionButtonProps = {
	element?: HTMLButtonElement | null;
	className?: string;
	id?: string;
	type?: ButtonType;
	variant?: RoundedActionButtonVariant;
	contentAlign?: RoundedActionButtonContentAlign;
	fullWidth?: boolean;
	busy?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
	formAction?: string;
	formNoValidate?: boolean;
	"aria-controls"?: string;
	"aria-describedby"?: string;
	"aria-expanded"?: boolean | "true" | "false";
	"aria-pressed"?: boolean | "true" | "false";
	onclick?: ButtonClickHandler;
	onkeydown?: ButtonKeyboardHandler;
	onpointerdown?: ButtonPointerHandler;
	onpointermove?: ButtonPointerHandler;
	onpointerup?: ButtonPointerHandler;
	onpointercancel?: ButtonPointerHandler;
	onlostpointercapture?: ButtonPointerHandler;
	children?: Snippet;
};
