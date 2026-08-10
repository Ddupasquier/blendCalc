import type { BasicIconProps } from "../types";

export type ChevronDirection = "up" | "right" | "down" | "left";

export type ChevronProps = BasicIconProps & {
	direction?: ChevronDirection;
};
