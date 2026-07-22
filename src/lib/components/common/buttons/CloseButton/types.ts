import type { ButtonClickHandler } from "$lib/components/common/buttons/types";

export type CloseButtonSize = "small" | "medium";

export type CloseButtonProps = {
	label?: string;
	size?: CloseButtonSize;
	disabled?: boolean;
	onclick?: ButtonClickHandler;
	class?: string;
};
