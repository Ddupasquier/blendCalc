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

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user, role, permissions } = await requireModeratorPermission(
		locals,
		"moderation.access",
		"/profile/privileged-tools",
	);
	const inherited = await parent();
	const inheritedAccess = inherited.privilegedToolAccess;
	const inheritedPermissions = new Set<string>(
		inheritedAccess?.permissions ?? [],
	);
	const currentPermissions = new Set<string>(permissions);
	const matchingParentSummary =
		inherited.authUser?.id === user.id &&
		inheritedAccess?.role === role &&
		inheritedPermissions.size === currentPermissions.size &&
		[...currentPermissions].every((permission) =>
			inheritedPermissions.has(permission),
		) &&
		!inheritedAccess.reviewSummary.identityVerificationRequired;
	// Profile layout owns this request's summary/admission pass. Reuse its
	// exact authorized snapshot; never treat parent data as access authorization.
	const reviewSummary = matchingParentSummary
		? inheritedAccess!.reviewSummary
		: await readPrivilegedToolReviewSummary(locals.supabase).catch(() =>
				getUnavailablePrivilegedToolReviewSummary(),
			);
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
