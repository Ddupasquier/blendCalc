import type { Snippet } from "svelte";
import type {
	CircleIconButtonSize,
	CircleIconButtonVariant,
} from "$lib/components/common/buttons/types";

export type AcceleratingStepButtonProps = {
	label: string;
	variant?: CircleIconButtonVariant;
	size?: CircleIconButtonSize;
	disabled?: boolean;
	onStep: (step: number) => void;
	children?: Snippet;
};
