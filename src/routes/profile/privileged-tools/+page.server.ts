import type { PageServerLoad } from "./$types";
import {
	readCatalogDataOperationsHealth,
	readCatalogMonitorModerationSummary,
} from "$lib/server/moderation/catalogDataOperations.server";
import { requireModeratorPermission } from "$lib/server/moderation/moderationAccess.server";
import {
	getUnavailablePrivilegedToolReviewSummary,
	readPrivilegedToolReviewSummary,
} from "$lib/server/moderation/privilegedToolReviewSummary.server";
import {
	hasAppPermission,
	PROFILE_PRIVILEGED_TOOL_PERMISSIONS,
} from "$lib/utils/moderation/profilePrivilegedTools";

export const load: PageServerLoad = async ({ locals }) => {
	const { role, permissions } = await requireModeratorPermission(
		locals,
		"moderation.access",
		"/profile/privileged-tools",
	);
	const reviewSummary = await readPrivilegedToolReviewSummary(
		locals.supabase,
	).catch(() => getUnavailablePrivilegedToolReviewSummary());
	const canReadDiagnostics = hasAppPermission(
		permissions,
		PROFILE_PRIVILEGED_TOOL_PERMISSIONS.dataOperationsRead,
	);
	let diagnostics = null;
	let diagnosticsUnavailable = false;
	if (canReadDiagnostics) {
		try {
			const [dashboard, catalogMonitor] = await Promise.all([
				readCatalogDataOperationsHealth(locals.supabase),
				readCatalogMonitorModerationSummary(locals.supabase),
			]);
			diagnostics = { dashboard, catalogMonitor };
		} catch {
			diagnosticsUnavailable = true;
		}
	}

	return {
		access: { role, permissions, reviewSummary },
		diagnostics,
		diagnosticsUnavailable,
	};
};
