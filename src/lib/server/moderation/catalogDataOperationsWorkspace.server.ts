import type { RequestEvent } from "@sveltejs/kit";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import { readPrivilegedToolReviewSummary } from "$lib/server/moderation/privilegedToolReviewSummary.server";

type CatalogDataOperationsLoadEvent = Pick<RequestEvent, "locals">;

export const loadCatalogDataOperationsWorkspace = async (
	{ locals }: CatalogDataOperationsLoadEvent,
	returnPath = "/profile/privileged-tools/data-operations",
) => {
	const { role } = await requireModeratorPermission(
		locals,
		"data_operations.catalog_health.read",
		returnPath,
	);
	const actionSummary = await readPrivilegedToolReviewSummary(
		locals.supabase,
	).catch(() => null);

	return {
		viewerRole: role,
		actionCount: actionSummary?.pendingCatalogDataOperations ?? null,
		actionSubjects: actionSummary?.catalogDataOperationSubjects ?? null,
		actionSubjectsTruncated:
			actionSummary?.catalogDataOperationSubjectsTruncated ?? false,
	};
};
export type CatalogDataOperationsWorkspaceData = Awaited<
	ReturnType<typeof loadCatalogDataOperationsWorkspace>
>;
