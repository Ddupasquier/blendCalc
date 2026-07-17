export type ScrollListReturnToTopProps = {
	scrollContainer: HTMLElement | null;
	hasMoreItems?: boolean;
	contentVersion?: string | number;
	containerElement?: "div" | "li";
};
