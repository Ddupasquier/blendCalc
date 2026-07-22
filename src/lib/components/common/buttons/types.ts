export type ButtonType = "button" | "submit" | "reset";

export type CircleIconButtonVariant =
	| "primary"
	| "soft"
	| "ghost"
	| "inverse"
	| "outline"
	| "danger";

export type CircleIconButtonSize = "tiny" | "small" | "control" | "fab";

export type ButtonClickHandler = (event: MouseEvent) => void;

export type ButtonFocusHandler = (event: FocusEvent) => void;

export type ButtonKeyboardHandler = (event: KeyboardEvent) => void;

export type ButtonPointerHandler = (event: PointerEvent) => void;
