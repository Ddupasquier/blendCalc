import {
  requireAppValue,
  throwAppError,
} from "$lib/server/errors/appError.server";
import {
  getUserAppRole,
  isModerationAppRole,
  type AppRole,
} from "$lib/utils/moderation/moderation";
import type { VerifiedAuthUser } from "$lib/utils/auth/types";
import { redirect } from "@sveltejs/kit";
import {
  requireElevatedAuthenticatorAssuranceForApi,
  requireElevatedAuthenticatorAssuranceForPage,
} from "$lib/server/auth/mfaAccess.server";

export type ModeratorAccess = {
  user: VerifiedAuthUser;
  role: AppRole;
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
