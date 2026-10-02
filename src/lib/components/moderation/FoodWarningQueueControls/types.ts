export type FoodWarningQueueControlsProps = {
	label: string;
	loadedCount: number;
	total: number;
	hasMore: boolean;
	loading: boolean;
	error: string;
	scrollContainer: HTMLElement | null;
	onLoadMore: () => void | Promise<void>;
	onRetry: () => void | Promise<void>;
};
