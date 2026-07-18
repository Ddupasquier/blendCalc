import type { Snippet } from "svelte";

export type TextBadgeTone = "info" | "success" | "custom" | "neutral";

export type TextBadgeProps = {
	label: string;
	ariaLabel?: string;
	title?: string;
	tone?: TextBadgeTone;
	class?: string;
};

export type StatusIconBadgeTone = "info" | "success" | "warning" | "error";

export type StatusIconBadgeProps = {
	label: string;
	title?: string;
	tone?: StatusIconBadgeTone;
	decorative?: boolean;
	class?: string;
	children: Snippet;
};

export type VerifiedStatusBadgeProps = {
	label: string;
	class?: string;
};

export type PrivilegedActionBadgeVariant = "action" | "profile";

export type PrivilegedActionBadgeProps = {
	label?: string;
	class?: string;
	variant?: PrivilegedActionBadgeVariant;
};
