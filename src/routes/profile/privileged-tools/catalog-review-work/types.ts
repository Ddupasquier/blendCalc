import type { CatalogReviewWorkWorkspaceData } from "$lib/server/moderation/catalogReviewWorkWorkspace.server";

export type CatalogReviewWorkPageProps = {
	data: CatalogReviewWorkWorkspaceData;
	form?: {
		catalogReviewError?: string;
		catalogReviewSuccess?: string;
	} | null;
};
