export type PaginatedListControlsProps = {
	scrollContainer: HTMLElement | null;
	hasMoreItems?: boolean;
	loadingMore?: boolean;
	loadMoreDisabled?: boolean;
	loadMoreLabel?: string;
	contentVersion?: string | number;
	containerElement?: "div" | "li";
	onLoadMore?: () => void | Promise<void>;
};
