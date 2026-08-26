import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import {
	getUserAppRole,
	isModerationAppRole,
	type AppPermission,
	type AppRole,
} from "$lib/utils/moderation/moderation";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import { redirect } from "@sveltejs/kit";
import {
	requireElevatedAuthenticatorAssuranceForApi,
	requireElevatedAuthenticatorAssuranceForPage,
} from "$lib/server/auth/mfaAccess.server";
import { readAppRolePermissions } from "$lib/server/moderation/appRolePermissions.server";

export type ModeratorAccess = {
	user: VerifiedAuthUser;
	role: AppRole;
};

export type ModeratorPermissionAccess = ModeratorAccess & {
	permissions: AppPermission[];
};

export const requireModeratorAccess = async (
	locals: App.Locals,
	returnPath = "/moderation",
): Promise<ModeratorAccess> => {
	const user = await locals.getVerifiedUser();
	if (!user) {
		throw redirect(303, `/auth?next=${encodeURIComponent(returnPath)}`);
	}

	const role = requireAppValue(
		await getUserAppRole(locals.supabase, user.id),
		403,
		"ACCESS_DENIED",
	);
	if (!isModerationAppRole(role)) {
		throwAppError(403, "ACCESS_DENIED");
	}

	await requireElevatedAuthenticatorAssuranceForPage(
		locals.supabase,
		returnPath,
	);

	return { user, role };
};

export const requireModeratorApiAccess = async (
	locals: App.Locals,
): Promise<ModeratorAccess> => {
	const user = requireAppValue(
		await locals.getVerifiedUser(),
		401,
		"AUTH_REQUIRED",
	);
	const role = requireAppValue(
		await getUserAppRole(locals.supabase, user.id),
		403,
		"ACCESS_DENIED",
	);
	if (!isModerationAppRole(role)) {
		throwAppError(403, "ACCESS_DENIED");
	}

	await requireElevatedAuthenticatorAssuranceForApi(locals.supabase);
	return { user, role };
};

export const requireModeratorPermission = async (
	locals: App.Locals,
	permission: AppPermission,
	returnPath = "/moderation",
): Promise<ModeratorPermissionAccess> => {
	const access = await requireModeratorAccess(locals, returnPath);
	const permissions = await readAppRolePermissions(access.role);
	if (!permissions.includes(permission)) {
		throwAppError(403, "ACCESS_DENIED");
	}

	return { ...access, permissions };
};
