export type LoadingSpinnerSize = "small" | "medium" | "large";

export type LoadingSpinnerProps = {
	size?: LoadingSpinnerSize;
	label?: string;
	showLabel?: boolean;
	decorative?: boolean;
	class?: string;
};
