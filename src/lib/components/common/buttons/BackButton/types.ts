import type {
	ButtonClickHandler,
	CircleIconButtonSize,
	CircleIconButtonVariant,
} from "$lib/components/common/buttons/types";

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
