import type { PageData } from "./$types";

export type CatalogReviewProductPageProps = {
	data: PageData;
	form?: {
		catalogReviewError?: string;
		catalogReviewSuccess?: string;
	} | null;
};
