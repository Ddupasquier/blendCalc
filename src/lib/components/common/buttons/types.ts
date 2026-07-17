import type { Snippet } from "svelte";

export type ButtonType = "button" | "submit" | "reset";

export type ActionButtonVariant =
	| "primary"
	| "secondary"
	| "highlight"
	| "success"
	| "danger"
	| "ghost";

export type ActionButtonSize = "small" | "medium" | "large";

export type CircleIconButtonVariant =
	| "primary"
	| "soft"
	| "ghost"
	| "inverse"
	| "outline"
	| "danger";

export type CircleIconButtonSize = "tiny" | "small" | "control" | "fab";

export type CloseButtonSize = "small" | "medium";

export type PillButtonVariant = "neutral" | "primary" | "danger";

export type RoundedActionButtonVariant =
	| "primary"
	| "outline"
	| "quiet"
	| "soft"
	| "neutral"
	| "dashed";

export type ButtonClickHandler = (event: MouseEvent) => void;

export type ButtonFocusHandler = (event: FocusEvent) => void;

export type ButtonKeyboardHandler = (event: KeyboardEvent) => void;

export type ButtonPointerHandler = (event: PointerEvent) => void;

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

export type AcceleratingStepButtonProps = {
	label: string;
	variant?: CircleIconButtonVariant;
	size?: CircleIconButtonSize;
	disabled?: boolean;
	onStep: (step: number) => void;
	children?: Snippet;
};

export type IconControlButtonProps = {
	type?: ButtonType;
	label: string;
	active?: boolean;
	busy?: boolean;
	disabled?: boolean;
	class?: string;
	"aria-expanded"?: boolean | "true" | "false";
	"aria-controls"?: string;
	onclick?: ButtonClickHandler;
	children?: Snippet;
};

export type CloseButtonProps = {
	label?: string;
	size?: CloseButtonSize;
	disabled?: boolean;
	onclick?: ButtonClickHandler;
	class?: string;
};

export type BackButtonProps = {
	label?: string;
	variant?: Extract<
		CircleIconButtonVariant,
		"primary" | "soft" | "ghost" | "inverse"
	>;
	size?: CircleIconButtonSize;
	class?: string;
	onclick?: ButtonClickHandler;
};

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

export type RoundedActionButtonProps = {
	type?: ButtonType;
	variant?: RoundedActionButtonVariant;
	fullWidth?: boolean;
	busy?: boolean;
	disabled?: boolean;
	privileged?: boolean;
	ariaLabel?: string;
	onclick?: ButtonClickHandler;
	children?: Snippet;
};

export type SegmentedControlOption = {
	value: string;
	label: string;
	count?: number;
	id?: string;
	controlsId?: string;
};

export type SegmentedControlProps = {
	label: string;
	options: SegmentedControlOption[];
	value: string;
	onSelect: (value: string) => void;
};
