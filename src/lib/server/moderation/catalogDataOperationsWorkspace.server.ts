import type { RequestEvent } from "@sveltejs/kit";
import {
	readCatalogMonitorModerationSummary,
	readCatalogDataOperationsHealth,
} from "$lib/server/moderation/catalogDataOperations.server";
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
	const [dashboard, catalogMonitor, actionSummary] = await Promise.all([
		readCatalogDataOperationsHealth(locals.supabase),
		readCatalogMonitorModerationSummary(locals.supabase),
		readPrivilegedToolReviewSummary(locals.supabase).catch(() => null),
	]);

	return {
		viewerRole: role,
		dashboard,
		catalogMonitor,
		actionCount: actionSummary?.pendingCatalogDataOperations ?? null,
	};
};
export type CatalogDataOperationsWorkspaceData = Awaited<
	ReturnType<typeof loadCatalogDataOperationsWorkspace>
>;
