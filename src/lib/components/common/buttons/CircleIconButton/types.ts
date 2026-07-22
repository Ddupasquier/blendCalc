import type { Snippet } from "svelte";
import type {
	ButtonClickHandler,
	ButtonFocusHandler,
	ButtonKeyboardHandler,
	ButtonPointerHandler,
	ButtonType,
	CircleIconButtonSize,
	CircleIconButtonVariant,
} from "$lib/components/common/buttons/types";

export type CircleIconButtonProps = {
	type?: ButtonType;
	label: string;
	variant?: CircleIconButtonVariant;
	size?: CircleIconButtonSize;
	busy?: boolean;
	disabled?: boolean;
	pressed?: boolean;
	class?: string;
	"aria-describedby"?: string;
	onclick?: ButtonClickHandler;
	onfocus?: ButtonFocusHandler;
	onkeydown?: ButtonKeyboardHandler;
	onkeyup?: ButtonKeyboardHandler;
	onpointerdown?: ButtonPointerHandler;
	onpointerup?: ButtonPointerHandler;
	onpointercancel?: ButtonPointerHandler;
	onlostpointercapture?: ButtonPointerHandler;
	oncontextmenu?: ButtonClickHandler;
	children?: Snippet;
};
