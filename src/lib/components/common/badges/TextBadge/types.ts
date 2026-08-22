export type TextBadgeTone =
	| "info"
	| "success"
	| "warning"
	| "custom"
	| "neutral";

export type TextBadgeProps = {
	label: string;
	ariaLabel?: string;
	title?: string;
	tone?: TextBadgeTone;
	class?: string;
};
