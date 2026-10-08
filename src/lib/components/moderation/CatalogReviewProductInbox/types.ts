import type { CatalogReviewPage } from "$lib/utils/moderation/catalogReviewPagination";

export type CatalogReviewProductInboxProps = {
	page: CatalogReviewPage<"products">;
	scrollContainer: HTMLElement | null;
	onPageChange?: (page: CatalogReviewPage<"products">) => void;
};
