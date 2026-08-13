export type ButtonType = "button" | "submit" | "reset";

export type CircleIconButtonVariant =
	| "primary"
	| "soft"
	| "ghost"
	| "inverse"
	| "outline"
	| "danger-soft"
	| "danger";

export type CircleIconButtonSize = "tiny" | "small" | "control";

export type ButtonClickHandler = (event: MouseEvent) => void;

export type ButtonFocusHandler = (event: FocusEvent) => void;

export type ButtonKeyboardHandler = (event: KeyboardEvent) => void;

export type ButtonPointerHandler = (event: PointerEvent) => void;
