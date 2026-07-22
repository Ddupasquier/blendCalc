import type { Snippet } from "svelte";
import type {
	RoundedActionButtonContentAlign,
	RoundedActionButtonVariant,
} from "$lib/components/common/buttons/RoundedActionButton/types";

export type RoundedActionLinkProps = {
	href: string;
	variant?: RoundedActionButtonVariant;
	contentAlign?: RoundedActionButtonContentAlign;
	fullWidth?: boolean;
	target?: "_blank" | "_parent" | "_self" | "_top";
	rel?: string;
	ariaLabel?: string;
	children?: Snippet;
};
