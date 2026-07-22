import type { Snippet } from "svelte";
import type {
	ButtonClickHandler,
	ButtonType,
} from "$lib/components/common/buttons/types";

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
